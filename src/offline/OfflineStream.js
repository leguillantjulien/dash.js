/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */
import EventBus from './../core/EventBus';
import Events from './../core/events/Events';
import OfflineEvents from './OfflineEvents';
import FactoryMaker from './../core/FactoryMaker';
import Debug from './../core/Debug';
import BaseURLController from './../streaming/controllers/BaseURLController';
import FragmentController from './../streaming/controllers/FragmentController';
import OfflineStreamProcessor from './OfflineStreamProcessor';
import Constants from './../streaming/constants/Constants';
import RequestModifier from './../streaming/utils/RequestModifier';


function OfflineStream(config) {

    config = config || {};
    const context = this.context;
    const eventBus = EventBus(context).getInstance();

    const DOWNLOAD_FINISHED = 'finished';

    let instance,
        adapter,
        abrController,
        baseURLController,
        dashManifestModel,
        metricsModel,
        offlineStreamProcessor,
        offlineStreamProcessors,
        finishedOfflineStreamProcessors,
        timelineConverter,
        errHandler,
        streamInfo,
        fragmentController,
        availableSegments,
        allSelectedMediaBitrateList,
        logger;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        resetInitialSettings();
        Events.extend(OfflineEvents);
    }

    function resetInitialSettings() {
        offlineStreamProcessors = [];
        availableSegments = 0;
        streamInfo = null;
        offlineStreamProcessors = [];
        finishedOfflineStreamProcessors = 0;
        allSelectedMediaBitrateList = [];
    }

    function setConfig(config) {
        if (!config) return;

        if (config.metricsModel) {
            metricsModel = config.metricsModel;
        }

        if (config.dashManifestModel) {
            dashManifestModel = config.dashManifestModel;
        }

        if (config.adapter) {
            adapter = config.adapter;
        }

        if (config.errHandler) {
            errHandler = config.errHandler;
        }

        if (config.timelineConverter) {
            timelineConverter = config.timelineConverter;
        }

        if (config.abrController) {
            abrController = config.abrController;
        }

    }

    function initialize(StreamInfo) {
        streamInfo = StreamInfo;
        fragmentController = FragmentController(context).create({
            errHandler: errHandler,
            metricsModel: metricsModel,
            requestModifier: RequestModifier(context).getInstance()
        });
        baseURLController = BaseURLController(context).getInstance();
        baseURLController.setConfig({
            dashManifestModel: dashManifestModel
        });
        initializeMediaBitrate(streamInfo);
        setAvailableSegments();
        eventBus.on(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
        eventBus.on(Events.OFFLINE_STREAM_PROCESSOR_COMPLETED, onOfflineStreamProcessorCompleted, this);
    }

    function initializeMediaBitrate(streamInfo) {
        let availableBitRateList = [];
        if (getBitrateListForType(Constants.VIDEO, streamInfo) !== null) {
            availableBitRateList.push(getBitrateListForType(Constants.VIDEO, streamInfo));
        }
        if (getBitrateListForType(Constants.AUDIO, streamInfo) !== null) {
            availableBitRateList.push(getBitrateListForType(Constants.AUDIO, streamInfo));
        }
        if (getBitrateListForType(Constants.TEXT, streamInfo) !== null) {
            availableBitRateList.push(getBitrateListForType(Constants.TEXT, streamInfo));
        }
        if (getBitrateListForType(Constants.FRAGMENTED_TEXT, streamInfo) !== null) {
            availableBitRateList.push(getBitrateListForType(Constants.FRAGMENTED_TEXT, streamInfo));
        }
        if (getBitrateListForType(Constants.EMBEDDED_TEXT, streamInfo)) {
            availableBitRateList.push(getBitrateListForType(Constants.EMBEDDED_TEXT, streamInfo));
        }
        if (getBitrateListForType(Constants.MUXED, streamInfo) !== null) {
            availableBitRateList.push(getBitrateListForType(Constants.MUXED, streamInfo));
        }
        if (getBitrateListForType(Constants.IMAGE, streamInfo) !== null) {
            availableBitRateList.push(getBitrateListForType(Constants.IMAGE, streamInfo));
        }

        eventBus.trigger(Events.AVAILABLE_BITRATES_LOADED, {
            data: availableBitRateList,
            sender: this
        });
    }

    function getBitrateListForType(type, streamInfo) {
        const allMediaForType =  adapter.getAllMediaInfoForType(streamInfo, type);
        let mediaInfo = getMediaInfoForType(type, allMediaForType);
        return abrController.getBitrateList(mediaInfo);
    }

    function setSelectedMediaInfosForOfflineStream(allMediaBitrateList) {
        allSelectedMediaBitrateList = allMediaBitrateList;
        initializeMedia(streamInfo);
        setAvailableSegments();
    }

    function initializeMedia(streamInfo) {
        initializeMediaForType(Constants.VIDEO,streamInfo);
        initializeMediaForType(Constants.AUDIO,streamInfo);
        initializeMediaForType(Constants.TEXT,streamInfo);
        initializeMediaForType(Constants.FRAGMENTED_TEXT,streamInfo);
        initializeMediaForType(Constants.EMBEDDED_TEXT,streamInfo);
        initializeMediaForType(Constants.MUXED,streamInfo);
        initializeMediaForType(Constants.IMAGE,streamInfo);

    }

    function initializeMediaForType(type, streamInfo) {
        const allMediaForType = adapter.getAllMediaInfoForType(streamInfo, type);
        let mediaInfo = getMediaInfoForType(type, allMediaForType);
        if (mediaInfo !== null) {
            mediaInfo = keepOnlySelectedBitrate(type, mediaInfo);
            createOfflineStreamProcessor(mediaInfo, allMediaForType);
        }

    }

    function keepOnlySelectedBitrate(type, mediaInfo) {
        let bitrateForType = getSelectedBitrateListForType(type,allSelectedMediaBitrateList);
        if (bitrateForType !== null) {
            mediaInfo.bitrateList = bitrateForType;
        }
        return mediaInfo;
    }

    function getSelectedBitrateListForType(type, allSelectedMediaBitrateList) {
        let currentMediaBitrate,
            bitrateForType;

        bitrateForType = null;

        for (let i = 0; i < allSelectedMediaBitrateList.length; i++) {
            currentMediaBitrate = JSON.parse(allSelectedMediaBitrateList[i]);
            if (type == currentMediaBitrate.mediaType) {
                bitrateForType = currentMediaBitrate;
            }
        }
        return bitrateForType;
    }


    function getMediaInfoForType(type, allMediaForType) {
        let mediaInfo = null;

        if (!allMediaForType || allMediaForType.length === 0) {
            logger.info('No ' + type + ' data.');
            return null;
        }

        for (let i = 0, ln = allMediaForType.length; i < ln; i++) {
            mediaInfo = allMediaForType[i];
        }
        return mediaInfo;
    }

    function getFragmentController() {
        return fragmentController;
    }

    function createOfflineStreamProcessor(mediaInfo, allMediaForType, optionalSettings) {
        let offlineStreamProcessor = OfflineStreamProcessor(context).create();
        offlineStreamProcessor.setConfig({
            type: mediaInfo.type,
            mimeType: mediaInfo.mimeType,
            qualityIndex: mediaInfo.bitrateList ? mediaInfo.bitrateList.qualityIndex : null,
            timelineConverter: timelineConverter,
            adapter: adapter,
            dashManifestModel: dashManifestModel,
            baseURLController: baseURLController,
            errHandler: errHandler,
            stream: instance,
            abrController: abrController,
            metricsModel: metricsModel
        });
        offlineStreamProcessors.push(offlineStreamProcessor);
        offlineStreamProcessor.initialize();

        if (optionalSettings) {
            offlineStreamProcessor.getIndexHandler().setCurrentTime(optionalSettings.currentTime);
        }

        if (optionalSettings && optionalSettings.ignoreMediaInfo) {
            return;
        }

        if ((mediaInfo.type === Constants.TEXT || mediaInfo.type === Constants.FRAGMENTED_TEXT)) {
            let idx;
            for (let i = 0; i < allMediaForType.length; i++) {
                if (allMediaForType[i].index === mediaInfo.index) {
                    idx = i;
                }
                offlineStreamProcessor.addMediaInfo(allMediaForType[i]); //creates text tracks for all adaptations in one stream processor
            }
            offlineStreamProcessor.selectMediaInfo(allMediaForType[idx]); //sets the initial media info
        } else {
            offlineStreamProcessor.addMediaInfo(mediaInfo, true);
        }
    }

    function onOfflineStreamProcessorCompleted(e) {
        let sp = e.sender.getStreamProcessor();
        if (sp.getStreamInfo() !== streamInfo) {
            return;
        }
        finishedOfflineStreamProcessors++;
        if (finishedOfflineStreamProcessors === offlineStreamProcessors.length) {
            eventBus.trigger(Events.DOWNLOADING_FINISHED, {sender: this, status: DOWNLOAD_FINISHED, message: 'Downloading has been successfully completed for this stream !'});
        }
    }

    function onDataUpdateCompleted(e) {
        let sp = e.sender.getStreamProcessor();
        if (sp.getStreamInfo() !== streamInfo) {
            return;
        }

        sp.start();
    }

    function getStreamInfo() {
        return streamInfo;
    }

    function getStartTime() {
        return streamInfo ? streamInfo.start : NaN;
    }

    function getDuration() {
        return streamInfo ? streamInfo.duration : NaN;
    }

    function stopOfflineStreamProcessors() {
        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            offlineStreamProcessors[i].stop();
        }
    }

    function resumeOfflineStreamProcessors() {
        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            offlineStreamProcessors[i].resume();
        }
    }

    function getRecordProgression() {
        let getDownloadedSegments = 0;

        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            getDownloadedSegments = getDownloadedSegments + offlineStreamProcessors[i].getDownloadedSegments();
        }
        return getDownloadedSegments / getAvailableSegments();
    }

    function setAvailableSegments() {
        //TODO compter par taille de segments et non par le nombre
        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            if (offlineStreamProcessors[i].getAvailableSegmentsNumber()) {
                availableSegments = availableSegments +  offlineStreamProcessors[i].getAvailableSegmentsNumber();
            } else {    //format différent
                availableSegments = 0;
            }
        }
    }
    function getAvailableSegments() {
        return availableSegments;
    }

    function deactivate() {
        let ln = offlineStreamProcessors ? offlineStreamProcessors.length : 0;
        for (let i = 0; i < ln; i++) {
            let fragmentModel = offlineStreamProcessors[i].getFragmentModel();
            fragmentModel.removeExecutedRequestsBeforeTime(getStartTime() + getDuration());
            offlineStreamProcessors[i].reset();
        }
    }

    function reset() {

        if (fragmentController) {
            fragmentController.reset();
            fragmentController = null;
        }
        deactivate();
        resetInitialSettings();

        eventBus.off(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
        eventBus.off(Events.OFFLINE_STREAM_PROCESSOR_COMPLETED, onOfflineStreamProcessorCompleted, this);
    }

    instance = {
        initialize: initialize,
        setConfig: setConfig,
        setSelectedMediaInfosForOfflineStream: setSelectedMediaInfosForOfflineStream,
        offlineStreamProcessor: offlineStreamProcessor,
        getFragmentController: getFragmentController,
        getStreamInfo: getStreamInfo,
        stopOfflineStreamProcessors: stopOfflineStreamProcessors,
        resumeOfflineStreamProcessors: resumeOfflineStreamProcessors,
        getRecordProgression: getRecordProgression,
        getAvailableSegments: getAvailableSegments,
        setAvailableSegments: setAvailableSegments,
        reset: reset
    };

    setup();
    return instance;
}

OfflineStream.__dashjs_factory_name = 'OfflineStream';
export default FactoryMaker.getClassFactory(OfflineStream);
