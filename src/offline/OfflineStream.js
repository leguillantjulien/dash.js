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

    let instance,
        adapter,
        abrController,
        baseURLController,
        dashManifestModel,
        metricsModel,
        offlineStreamProcessor,
        offlineStreamProcessors,
        timelineConverter,
        errHandler,
        streamInfo,
        fragmentController,
        logger;

    function setup() {
        offlineStreamProcessors = [];
        logger = Debug(context).getInstance().getLogger(instance);
        resetInitialSettings();
        eventBus.on(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
    }

    function resetInitialSettings() {
        streamInfo = null;
        offlineStreamProcessors = [];
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
        initializeMedia(streamInfo);
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

        let mediaInfo = null;

        if (!allMediaForType || allMediaForType.length === 0) {
            logger.info('No ' + type + ' data.');
            return;
        }

        for (let i = 0, ln = allMediaForType.length; i < ln; i++) {
            mediaInfo = allMediaForType[i];
        }

        createOfflineStreamProcessor(mediaInfo, allMediaForType);
    }

    function getFragmentController() {
        return fragmentController;
    }

    function createOfflineStreamProcessor(mediaInfo, allMediaForType, optionalSettings) {
        offlineStreamProcessor = OfflineStreamProcessor(context).create();
        offlineStreamProcessor.setConfig({
            type: mediaInfo.type,
            mimeType: mediaInfo.mimeType,
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

    function stopOfflineStreamProcessors() {
        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            offlineStreamProcessors[i].stop();
        }
    }

    instance = {
        initialize: initialize,
        setConfig: setConfig,
        offlineStreamProcessor: offlineStreamProcessor,
        getFragmentController: getFragmentController,
        getStreamInfo: getStreamInfo,
        stopOfflineStreamProcessors: stopOfflineStreamProcessors
    };

    setup();
    return instance;
}

OfflineStream.__dashjs_factory_name = 'OfflineStream';
export default FactoryMaker.getClassFactory(OfflineStream);
