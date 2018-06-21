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
import OfflineStreamDownloader from './../net/OfflineStreamDownloader';
import OfflineStoreController from './OfflineStoreController';
import URLUtils from './../../streaming/utils/URLUtils';

function OfflineController(config) {

    config = config || {};
    const context = this.context;
    const eventBus = EventBus(context).getInstance();
    const Entities = require('html-entities').XmlEntities;

    let instance,
        manifestLoader,
        manifestUpdater,
        offlineStoreController,
        offlineStreamDownloader,
        urlUtils,
        logger;

    function setup() {
        offlineStoreController = OfflineStoreController(context).getInstance();
        manifestUpdater = ManifestUpdater(context).create();
        logger = Debug(context).getInstance().getLogger(instance);
        eventBus.on(Events.MANIFEST_UPDATED, onManifestUpdated, instance); //comment for offline play
        eventBus.on(Events.LOADING_COMPLETED, storeFragment, instance);
        eventBus.on(Events.FRAGMENT_COMPLETED, storeFragment, instance);
        eventBus.on(Events.STREAM_COMPLETED, createOfflineManifest, instance);
        urlUtils = URLUtils(context).getInstance();

    }

    function setConfig(config) {
        if (!config) return;

        if (config.manifestLoader) {
            manifestLoader = config.manifestLoader;
        }
    }

    function load(url) {
        manifestLoader.load(url);
    }

    function onManifestUpdated(e) {
        logger.info('onManifestUpdated' + e);

        createOfflineStreamDownloader(mediaInfo, mediaSource);


    }

    function createOfflineStreamDownloader(mediaInfo,mediaSource) {
        offlineStreamDownloader = OfflineStreamDownloader(context).create({
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
            abrController: abrController,
            playbackController: playbackController,
            mediaController: mediaController,
            textController: textController,
            errHandler: errHandler
        });

        offlineStreamDownloader.initialize(mediaSource);
        offlineStreamDownloader.start(e);
    }

    function createOfflineManifest(newBaseURL, XMLManifest) {
        logger.info('createOfflineManifest', newBaseURL);

        /*
        newBaseURL = 'offline_indexdb://' + urlUtils.removeHostname(newBaseURL)
        logger.info(XMLManifest);
        let DOM = new DOMParser().parseFromString(XMLManifest, "application/xml");
        if (DOM.getElementsByTagName("BaseURL")[0] != undefined) {
            let baseURLAttribute = DOM.getElementsByTagName("BaseURL")[0];
            baseURLAttribute.childNodes[0].nodeValue = newBaseURL;
            logger.info('x', baseURLAttribute.childNodes[0].nodeValue);
            let encodedManifest = new Entities().encode(new XMLSerializer().serializeToString(DOM));
            storeOfflineManifest(encodedManifest);
        } else { //create baseURL attribute
            logger.info('any baseURL attr')
            let baseURLAttribute = DOM.createElement('baseURL');
            baseURLAttribute.appendChild(DOM.createTextNode(newBaseURL));
            let encodedManifest = new Entities().encode(new XMLSerializer().serializeToString(DOM));
            storeOfflineManifest(encodedManifest);
        }
        */
    }

    function storeFragment(e) {
        if (e.request !== null) {
            console.log(e.request.url)
            let fragmentId = urlUtils.removeHostname(e.request.url);
            logger.info("fragmentId "+ fragmentId)
            offlineStoreController.storeFragment(fragmentId, e.response);
        }
    }

    function storeOfflineManifest(e) {
        offlineStoreController.storeOfflineManifest(e);
    }

    instance = {
        load: load,
        onManifestUpdated: onManifestUpdated,
        setConfig: setConfig,
        storeFragment: storeFragment,
        createOfflineManifest: createOfflineManifest,
        storeOfflineManifest: storeOfflineManifest
    };

    setup();

    return instance;
}

OfflineController.__dashjs_factory_name = 'OfflineController';
export default FactoryMaker.getSingletonFactory(OfflineController);