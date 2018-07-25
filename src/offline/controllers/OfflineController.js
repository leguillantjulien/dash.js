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
import EventBus from './../../core/EventBus';
import Events from './../../core/events/Events';
import FactoryMaker from './../../core/FactoryMaker';
import Debug from './../../core/Debug';
import ManifestUpdater from './../../streaming/ManifestUpdater';
import BaseURLController from './../../streaming/controllers/BaseURLController';
import OfflineStoreController from './OfflineStoreController';
import OfflineStream from '../OfflineStream';
import URLUtils from './../../streaming/utils/URLUtils';
import OfflineIndexDBManifestParser from '../utils/OfflineIndexDBManifestParser';

function OfflineController(config) {

    config = config || {};
    const context = this.context;

    let instance,
        adapter,
        abrController,
        baseURLController,
        manifestLoader,
        manifestModel,
        manifestUpdater,
        metricsModel,
        dashManifestModel,
        offlineStoreController,
        timelineConverter,
        urlUtils,
        errHandler,
        stream,
        manifest,
        logger;

    urlUtils = URLUtils(context).getInstance();
    const eventBus = EventBus(context).getInstance();

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, storeFragment, instance);
        eventBus.on(Events.INTERNAL_MANIFEST_LOADED, onManifestLoaded, instance);
        eventBus.on(Events.ORIGINAL_MANIFEST_LOADED, generateOfflineManifest, instance);
        eventBus.on(Events.MANIFEST_UPDATED, onManifestUpdated, instance); //comment for online play
    }


    function onManifestLoaded(e) {
        console.log('onManifestLoaded');
        if (e.manifest !== null) {
            manifest = e.manifest;
        } else {
            throw new Error('onManifestLoaded failed');
        }
    }

    function setConfig(config) {
        if (!config) return;

        if (config.abrController) {
            abrController = config.abrController;
        }

        if (config.manifestLoader) {
            manifestLoader = config.manifestLoader;
        }

        if (config.metricsModel) {
            metricsModel = config.metricsModel;
        }

        if (config.manifestModel) {
            manifestModel = config.manifestModel;
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

        manifestUpdater = ManifestUpdater(context).create();
        offlineStoreController = OfflineStoreController(context).getInstance();
        baseURLController = BaseURLController(context).getInstance();

        manifestUpdater.setConfig({
            manifestModel: manifestModel,
            dashManifestModel: dashManifestModel,
            manifestLoader: manifestLoader,
            errHandler: errHandler
        });

        baseURLController.setConfig({
            dashManifestModel: dashManifestModel
        });
        manifestUpdater.initialize();
    }

    function load(url) {
        manifestLoader.load(url);
    }

    function onManifestUpdated(e) {
        if (!e.error) {
            try {
                manifest = e.manifest;
                adapter.updatePeriods(manifest);
                baseURLController.initialize(manifest);
                composeStreams();
            } catch (err) {
                throw new Error(err);
            }
        }
    }

    function composeStreams() {
        try {
            const streamsInfo = adapter.getStreamsInfo();
            if (streamsInfo.length === 0) {
                throw new Error('There are no streams');
            }
            for (let i = 0, ln = streamsInfo.length; i < ln; i++) {
                const streamInfo = streamsInfo[i];
                stream = OfflineStream(context).create();
                stream.setConfig({
                    manifestModel: manifestModel,
                    manifestUpdater: manifestUpdater,
                    dashManifestModel: dashManifestModel,
                    adapter: adapter,
                    timelineConverter: timelineConverter,
                    errHandler: errHandler,
                    baseURLController: baseURLController,
                    offlineController: instance,
                    abrController: abrController,
                    metricsModel: metricsModel
                });
                stream.initialize(streamInfo);
            }
            eventBus.trigger(Events.STREAMS_COMPOSED);
        } catch (e) {
            logger.info(e);
            errHandler.manifestError(e.message, 'nostreamscomposed', manifestModel.getValue());
        }
    }

    function storeFragment(e) {
        if (e.request !== null) {
            let fragmentId = e.request.representationId + '_' + e.request.index;
            offlineStoreController.storeFragment(fragmentId, e.response);
        }
    }

    function storeOfflineManifest(encodedManifest) {
        offlineStoreController.storeOfflineManifest(manifest.url,encodedManifest);
    }


    function generateOfflineManifest(e) {
        let parser = OfflineIndexDBManifestParser(context).create();
        let offlineManifest = parser.parse(e.originalManifest);
        if (offlineManifest !== null) {
            storeOfflineManifest(offlineManifest);
        } else {
            throw new Error('falling parsing offline manifest');
        }

    }

    instance = {
        load: load,
        onManifestUpdated: onManifestUpdated,
        setConfig: setConfig,
        composeStreams: composeStreams
    };

    setup();

    return instance;
}

OfflineController.__dashjs_factory_name = 'OfflineController';
export default FactoryMaker.getSingletonFactory(OfflineController);
