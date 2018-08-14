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
import Debug from './../core/Debug';
import Events from './../core/events/Events';
import FactoryMaker from './../core/FactoryMaker';
import DashHandler from './../dash/DashHandler';
import Constants from './../streaming/constants/Constants';
import OfflineDownloaderRequestRule from './rules/OfflineDownloaderRequestRule';

function OfflineStreamProcessor() {

    let context = this.context;

    let instance,
        adapter,
        logger,
        indexHandler,
        type,
        errHandler,
        eventBus,
        mimeType,
        baseURLController,
        fragmentModel,
        dashManifestModel,
        timelineConverter,
        mediaInfo,
        abrController,
        updating,
        realAdaptation,
        currentVoRepresentation,
        offlineDownloaderRequestRule,
        downloadedSegments,
        metricsModel,
        isInitialized,
        representation,
        isStopped,
        stream,
        voRepresentations,
        qualityIndex;

    function setConfig(config) {

        if (!config) return;

        if (config.type) {
            type = config.type;
        }

        if (config.stream) {
            stream = config.stream;
        }

        if (config.adapter) {
            adapter = config.adapter;
        }

        if (config.errHandler) {
            errHandler = config.errHandler;
        }

        if (config.mimeType) {
            mimeType = config.mimeType;
        }

        if (config.qualityIndex) {
            qualityIndex = config.qualityIndex;
        }

        if (config.timelineConverter) {
            timelineConverter = config.timelineConverter;
        }

        if (config.adapter) {
            adapter = config.adapter;
        }

        if (config.baseURLController) {
            baseURLController = config.baseURLController;
        }

        if (config.abrController) {
            abrController = config.abrController;
        }

        if (config.metricsModel) {
            metricsModel = config.metricsModel;
        }

        if (config.dashManifestModel) {
            dashManifestModel = config.dashManifestModel;
        }

    }

    function setup() {
        resetInitialSettings();
        logger = Debug(context).getInstance().getLogger(instance);
        eventBus = EventBus(context).getInstance();
        eventBus.on(Events.STREAM_COMPLETED, onStreamCompleted, instance);
        eventBus.on(Events.REPRESENTATION_UPDATED, onRepresentationUpdated, instance);
        eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, instance);

    }


    function onFragmentLoadingCompleted(e) {
        if (e.sender !== fragmentModel) {
            return;
        }
        downloadedSegments++;

        if (e.error && e.request.serviceLocation && !isStopped) {
            fragmentModel.executeRequest(e.request);
        }
        //stop();
        download();
    }

    function getStreamProcessor() {
        return instance;
    }

    function onStreamCompleted(e) {
        if (e.fragmentModel !== fragmentModel) {
            return;
        }

        stop();
        logger.info('Stream is complete');
        eventBus.trigger(Events.OFFLINE_STREAM_PROCESSOR_COMPLETED, {sender: this});
    }

    function stop() {
        if (isStopped) {
            return;
        }
        isStopped = true;
    }

    function resume() {
        isStopped = false;
        download();
    }

    function initialize() {

        indexHandler = DashHandler(context).create({
            mimeType: mimeType,
            baseURLController: baseURLController,
            metricsModel: metricsModel,
            errHandler: errHandler,
            timelineConverter: timelineConverter
        });
        indexHandler.initialize(instance);

        fragmentModel = getFragmentController().getModel(type);

        offlineDownloaderRequestRule = OfflineDownloaderRequestRule(context).create();

        if (dashManifestModel.getIsTextTrack(mimeType)) {
            getInitRequest();
        }
    }

    function getIndexHandler() {
        return indexHandler;
    }

    function getFragmentController() {
        return stream ? stream.getFragmentController() : null;
    }

    function getFragmentModel() {
        return fragmentModel;
    }

    function addMediaInfo(newMediaInfo, selectNewMediaInfo) {

        if (selectNewMediaInfo) {
            selectMediaInfo(newMediaInfo);
        }
    }

    function selectMediaInfo(newMediaInfo) {
        if (newMediaInfo !== mediaInfo && (!newMediaInfo || !mediaInfo || (newMediaInfo.type === mediaInfo.type))) {
            mediaInfo = newMediaInfo;
        }
        updateData();
    }

    function getPeriodForStreamInfo(streamInfo, voPeriodsArray) {
        const ln = voPeriodsArray.length;

        for (let i = 0; i < ln; i++) {
            let voPeriod = voPeriodsArray[i];

            if (streamInfo.id === voPeriod.id) return voPeriod;
        }

        return null;
    }

    function updateData() {
        const selectedVoPeriod = getPeriodForStreamInfo(getStreamInfo(), adapter.getVoPeriods());
        const voAdaptation = adapter.getDataForMedia(mediaInfo);
        let id = mediaInfo ? mediaInfo.id : null;

        if (adapter.getVoPeriods().length > 0) {
            abrController.updateTopQualityIndex(mediaInfo);
            realAdaptation = id ? dashManifestModel.getAdaptationForId(id, adapter.getVoPeriods()[0].mpd.manifest, selectedVoPeriod.index) : dashManifestModel.getAdaptationForIndex(mediaInfo.index, adapter.getVoPeriods()[0].mpd.manifest, selectedVoPeriod.index);
            updateRepresentation(realAdaptation, voAdaptation, type);
        } else {
            throw new Error('Any Vo Periods for this streamInfo');
        }
    }

    function getInitRequest() {
        if (!representation) return null;
        let initRequest = indexHandler.getInitRequest(representation);
        return fragmentModel.executeRequest(initRequest);
    }


    function timeIsBuffered(time) {
        if (time !== undefined) {
            return true;
        }
    }
    function start() {
        if (!currentVoRepresentation) {
            throw new Error('Start denied to OfflineStreamProcessor');
        }
        isStopped = false;
        download();
    }

    function download() {
        if (isStopped) {
            return;
        }

        if (isNaN(currentVoRepresentation)) {
            if (!isInitialized) {
                getInitRequest();
                isInitialized = true;
            } else {
                let request = offlineDownloaderRequestRule.execute(instance);

                if (request) {
                    logger.info('getNextFragment - request is ' + request.url);
                    fragmentModel.executeRequest(request);
                }
            }
        }

        if (indexHandler.isMediaFinished(currentVoRepresentation) ) {
            stop();
        }
        getAvailableSegmentsNumber();
    }


    function updateRepresentation(newRealAdaptation, voAdaptation, type) {
        const streamInfo = getStreamInfo();
        if (qualityIndex === null) {
            qualityIndex = abrController.getTopQualityIndexFor(type, streamInfo.id);
        }
        updating = true;

        voRepresentations = updateRepresentations(voAdaptation);
        currentVoRepresentation = voRepresentations[qualityIndex] !== undefined ? voRepresentations[qualityIndex] : voRepresentations[voRepresentations.length - 1];
        realAdaptation = newRealAdaptation;

        if (type !== Constants.VIDEO && type !== Constants.AUDIO  && type !== Constants.TEXT && type !== Constants.FRAGMENTED_TEXT) {
            updating = false;
            return;
        }

        indexHandler.updateRepresentation(currentVoRepresentation, true); //Update only one Representation
    }

    function onRepresentationUpdated(e) {
        if (e.sender.getStreamProcessor() !== instance || !isUpdating()) return;

        representation = e.representation;
        eventBus.trigger(Events.DATA_UPDATE_COMPLETED, {sender: this, data: realAdaptation, currentRepresentation: currentVoRepresentation});
    }

    function updateRepresentations(voAdaptation) {
        return dashManifestModel.getRepresentationsForAdaptation(voAdaptation);
    }

    function getRepresentation() {
        return currentVoRepresentation;
    }

    function getCurrentRepresentationInfo() {
        return currentVoRepresentation ? adapter.convertDataToRepresentationInfo(currentVoRepresentation) : null;
    }

    function getStreamInfo() {
        return stream ? stream.getStreamInfo() : null;
    }

    function isUpdating() {
        return updating;
    }

    function getType() {
        return type;
    }

    function getMediaInfo() {
        return mediaInfo;
    }

    function getAvailableSegmentsNumber() {
        return voRepresentations.availableSegmentsNumber;
    }

    function getDownloadedSegments() {
        return downloadedSegments;
    }

    function resetInitialSettings() {
        voRepresentations = [];
        isInitialized = false;
        qualityIndex = null;
        downloadedSegments = 0;
        mimeType = null;
        mediaInfo = null;
        updating = false;
        realAdaptation = null;
        currentVoRepresentation = null;
        downloadedSegments = null;
        representation = null;
        type = null;
        stream = null;
    }

    function reset() {
        resetInitialSettings();
        indexHandler.reset();
        baseURLController.reset();
        metricsModel.clearAllCurrentMetrics();
        timelineConverter.reset();
        abrController.unRegisterStreamType(type);

        eventBus.off(Events.STREAM_COMPLETED, onStreamCompleted, instance);
        eventBus.off(Events.REPRESENTATION_UPDATED, onRepresentationUpdated, instance);
        eventBus.off(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, instance);
    }

    instance = {
        initialize: initialize,
        setConfig: setConfig,
        getIndexHandler: getIndexHandler,
        addMediaInfo: addMediaInfo,
        getCurrentRepresentationInfo: getCurrentRepresentationInfo,
        selectMediaInfo: selectMediaInfo,
        getFragmentController: getFragmentController,
        getFragmentModel: getFragmentModel,
        getStreamInfo: getStreamInfo,
        getMediaInfo: getMediaInfo,
        getType: getType,
        isUpdating: isUpdating,
        getRepresentation: getRepresentation,
        getPeriodForStreamInfo: getPeriodForStreamInfo,
        getStreamProcessor: getStreamProcessor,
        start: start,
        stop: stop,
        resume: resume,
        timeIsBuffered: timeIsBuffered,
        getAvailableSegmentsNumber: getAvailableSegmentsNumber,
        getDownloadedSegments: getDownloadedSegments,
        reset: reset
    };

    setup();

    return instance;
}
OfflineStreamProcessor.__dashjs_factory_name = 'OfflineStreamProcessor';
const factory = FactoryMaker.getClassFactory(OfflineStreamProcessor);
export default factory;