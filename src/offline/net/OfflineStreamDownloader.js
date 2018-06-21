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
import ManifestUpdater from './../../streaming/ManifestUpdater';
import EventBus from './../../core/EventBus';
import FactoryMaker from './../../core/FactoryMaker';
import RepresentationController from './../../dash/controllers/RepresentationController';
import DashHandler from './../../dash/DashHandler';
import FragmentModel from './../../streaming/models/FragmentModel';

function OfflineStreamController(config) {

    const context = this.context;

    let indexHandler;
    let type = config.type;
    let errHandler = config.errHandler;
    let mimeType = config.mimeType;
    let timelineConverter = config.timelineConverter;
    let adapter = config.adapter;
    let manifestModel = config.manifestModel;
    let mediaPlayerModel = config.mediaPlayerModel;
    let stream = config.stream;
    let abrController = config.abrController;
    let playbackController = config.playbackController;
    let streamController = config.streamController;
    let mediaController = config.mediaController;
    let textController = config.textController;
    let domStorage = config.domStorage;
    let metricsModel = config.metricsModel;
    let dashMetrics = config.dashMetrics;
    let dashManifestModel = config.dashManifestModel;

    let eventBus,
        representationController,
        dashHandler;

    representationController = RepresentationController(context).create();

    dashHandler = DashHandler(context).create(config);

    function setup(){
        eventBus = EventBus(context).getInstance();
        eventBus.on(Events.FRAGMENT_COMPLETED, onManifestUpdated, instance);
        eventBus.on(Events.STREAM_COMPLETED, onManifestUpdated, instance);

    }

    function initialize(mediaSource) {

        indexHandler = DashHandler(context).create({
            mimeType: mimeType,
            timelineConverter: timelineConverter,
            dashMetrics: dashMetrics,
            metricsModel: metricsModel,
            mediaPlayerModel: mediaPlayerModel,
            baseURLController: config.baseURLController,
            errHandler: errHandler
        });

        // initialize controllers
        indexHandler.initialize(instance);
        abrController.registerStreamType(type, instance);

        fragmentModel = stream.getFragmentController().getModel(type);
        fragmentModel.setStreamProcessor(instance);

        bufferController = createBufferControllerForType(type);
        scheduleController = ScheduleController(context).create({
            type: type,
            mimeType: mimeType,
            metricsModel: metricsModel,
            adapter: adapter,
            dashMetrics: dashMetrics,
            dashManifestModel: dashManifestModel,
            timelineConverter: timelineConverter,
            mediaPlayerModel: mediaPlayerModel,
            abrController: abrController,
            playbackController: playbackController,
            streamController: streamController,
            textController: textController,
            streamProcessor: instance,
            mediaController: mediaController
        });
        representationController = RepresentationController(context).create();
        representationController.setConfig({
            abrController: abrController,
            domStorage: domStorage,
            metricsModel: metricsModel,
            dashMetrics: dashMetrics,
            dashManifestModel: dashManifestModel,
            manifestModel: manifestModel,
            playbackController: playbackController,
            timelineConverter: timelineConverter,
            streamProcessor: instance
        });
        bufferController.initialize(mediaSource);
        scheduleController.initialize();
        representationController.initialize();
    }

    function start() {
        let representationQuality = representationController.getRepresentationForQuality();
        request = dashHandler.getNextSegmentRequest(representation);
    }


    function initializeMediaForType(type, mediaSource) {
        const allMediaForType = adapter.getAllMediaInfoForType(streamInfo, type);

        let mediaInfo = null;
        let initialMediaInfo;

        if (!allMediaForType || allMediaForType.length === 0) {
            logger.info('No ' + type + ' data.');
            return;
        }

        for (let i = 0, ln = allMediaForType.length; i < ln; i++) {
            mediaInfo = allMediaForType[i];

            if (type === Constants.EMBEDDED_TEXT) {
                textController.addEmbeddedTrack(mediaInfo);
            } else {
                if (!isMediaSupported(mediaInfo)) continue;
                mediaController.addTrack(mediaInfo);
            }
        }

        if (type === Constants.EMBEDDED_TEXT || mediaController.getTracksFor(type, streamInfo).length === 0) {
            return;
        }

        if (type === Constants.IMAGE) {
            thumbnailController = ThumbnailController(context).create({
                dashManifestModel: dashManifestModel,
                adapter: adapter,
                baseURLController: config.baseURLController,
                stream: instance
            });
            return;
        }

        mediaController.checkInitialMediaSettingsForType(type, streamInfo);
        initialMediaInfo = mediaController.getCurrentTrackFor(type, streamInfo);

        // TODO : How to tell index handler live/duration?
        // TODO : Pass to controller and then pass to each method on handler?

        createStreamProcessor(initialMediaInfo, allMediaForType, mediaSource);
    }

    function initializeMedia(mediaSource) {
        checkConfig();
        let events;
        let element = videoModel.getElement();

        //if initializeMedia is called from a switch period, eventController could have been already created.
        if (!eventController) {
            eventController = EventController(context).create();

            eventController.setConfig({
                manifestModel: manifestModel,
                manifestUpdater: manifestUpdater,
                playbackController: playbackController
            });
            events = adapter.getEventsFor(streamInfo);
            eventController.addInlineEvents(events);
        }

        isUpdating = true;

        filterCodecs(Constants.VIDEO);
        filterCodecs(Constants.AUDIO);

        if (element === null || (element && (/^VIDEO$/i).test(element.nodeName))) {
            initializeMediaForType(Constants.VIDEO, mediaSource);
        }
        initializeMediaForType(Constants.AUDIO, mediaSource);
        initializeMediaForType(Constants.TEXT, mediaSource);
        initializeMediaForType(Constants.FRAGMENTED_TEXT, mediaSource);
        initializeMediaForType(Constants.EMBEDDED_TEXT, mediaSource);
        initializeMediaForType(Constants.MUXED, mediaSource);
        initializeMediaForType(Constants.IMAGE, mediaSource);

        createBuffers();

        //TODO. Consider initialization of TextSourceBuffer here if embeddedText, but no sideloadedText.

        isMediaInitialized = true;
        isUpdating = false;

        if (streamProcessors.length === 0) {
            const msg = 'No streams to play.';
            errHandler.manifestError(msg, 'nostreams', manifestModel.getValue());
            logger.fatal(msg);
        } else {
            checkIfInitializationCompleted();
        }
    }

    function createBufferControllerForType(type) {
        let controller = null;

        if (type === Constants.VIDEO || type === Constants.AUDIO) {
            controller = BufferController(context).create({
                type: type,
                metricsModel: metricsModel,
                mediaPlayerModel: mediaPlayerModel,
                manifestModel: manifestModel,
                errHandler: errHandler,
                streamController: streamController,
                mediaController: mediaController,
                adapter: adapter,
                textController: textController,
                abrController: abrController,
                playbackController: playbackController,
                streamProcessor: instance
            });
        } else {
            controller = TextBufferController(context).create({
                type: type,
                mimeType: mimeType,
                metricsModel: metricsModel,
                mediaPlayerModel: mediaPlayerModel,
                manifestModel: manifestModel,
                errHandler: errHandler,
                streamController: streamController,
                mediaController: mediaController,
                adapter: adapter,
                textController: textController,
                abrController: abrController,
                playbackController: playbackController,
                streamProcessor: instance
            });
        }

        return controller;
    }


    function createStreamProcessor(mediaInfo, allMediaForType, mediaSource, optionalSettings) {
        let streamProcessor = StreamProcessor(context).create({
            type: mediaInfo.type,
            mimeType: mediaInfo.mimeType,
            timelineConverter: timelineConverter,
            adapter: adapter,
            manifestModel: manifestModel,
            dashManifestModel: dashManifestModel,
            mediaPlayerModel: mediaPlayerModel,
            metricsModel: metricsModel,
            dashMetrics: config.dashMetrics,
            baseURLController: config.baseURLController,
            stream: instance,
            abrController: abrController,
            domStorage: config.domStorage,
            playbackController: playbackController,
            mediaController: mediaController,
            streamController: config.streamController,
            textController: textController,
            errHandler: errHandler
        });

        streamProcessor.initialize(mediaSource);
        abrController.updateTopQualityIndex(mediaInfo);

        if (optionalSettings) {
            streamProcessor.setBuffer(optionalSettings.buffer);
            streamProcessor.getIndexHandler().setCurrentTime(optionalSettings.currentTime);
            streamProcessors[optionalSettings.replaceIdx] = streamProcessor;
        } else {
            streamProcessors.push(streamProcessor);
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
                streamProcessor.addMediaInfo(allMediaForType[i]); //creates text tracks for all adaptations in one stream processor
            }
            streamProcessor.selectMediaInfo(allMediaForType[idx]); //sets the initial media info
        } else {
            streamProcessor.addMediaInfo(mediaInfo, true);
        }
    }


    instance = {
        load: load,
        setConfig: setConfig,
        start: start
    };

    setup();

    return instance;
}
OfflineStreamController.__dashjs_factory_name = 'OfflineStreamController';
const factory = FactoryMaker.getClassFactory(OfflineStreamController);
export default factory;