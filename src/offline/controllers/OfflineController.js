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
import OfflineEvents from './../events/OfflineEvents';
import DOMExceptionsEvents from './../events/DOMExceptionsEvents';
import FactoryMaker from './../../core/FactoryMaker';
import Debug from './../../core/Debug';
import ManifestUpdater from './../../streaming/ManifestUpdater';
import BaseURLController from './../../streaming/controllers/BaseURLController';
import OfflineStoreController from './OfflineStoreController';
import OfflineStream from '../OfflineStream';
import OfflineIndexDBManifestParser from '../utils/OfflineIndexDBManifestParser';

/**
 * @class OfflineController
 */
function OfflineController() {

    const context = this.context;

    let instance,
        adapter,
        abrController,
        baseURLController,
        manifestId,
        manifestLoader,
        manifestModel,
        manifestUpdater,
        dashManifestModel,
        offlineStoreController,
        XMLManifest,
        errHandler,
        streams,
        manifest,
        isRecordingStatus,
        logger;

    const eventBus = EventBus(context).getInstance();

    function setup() {
        manifestUpdater = ManifestUpdater(context).create();
        offlineStoreController = OfflineStoreController(context).create();
        baseURLController = BaseURLController(context).getInstance();
        logger = Debug(context).getInstance().getLogger(instance);
        Events.extend(OfflineEvents);
        Events.extend(DOMExceptionsEvents);
        streams = [];
        isRecordingStatus = false;
    }

    function setConfig(config) {
        if (!config) return;

        if (config.abrController) {
            abrController = config.abrController;
        }

        if (config.manifestLoader) {
            manifestLoader = config.manifestLoader;
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

        manifestUpdater.setConfig({
            manifestModel: manifestModel,
            dashManifestModel: dashManifestModel,
            manifestLoader: manifestLoader,
            errHandler: errHandler
        });

        baseURLController.setConfig({
            dashManifestModel: dashManifestModel
        });

        offlineStoreController.setConfig({
            errHandler: errHandler
        });
        manifestUpdater.initialize();
    }

    /**
     * méthode appelée par le mediaPlayer, télécharge un stream à partir de l'url du manifest.
     * @param {string} url
     * @instance
    */
    function record(url) {
        setupOfflineEvents();
        manifestLoader.load(url);
        isRecordingStatus = true;
    }

    function setupOfflineEvents() {
        eventBus.on(Events.MANIFEST_UPDATED, onManifestUpdated, instance);
        eventBus.on(Events.ORIGINAL_MANIFEST_LOADED, onOriginalManifestLoaded, instance);
        eventBus.on(Events.DOWNLOADING_STARTED, onDownloadingStarted, instance);
        eventBus.on(Events.DOWNLOADING_FINISHED, onDownloadingFinished, instance);
        setupIndexedDBEvents();
    }

    function setupIndexedDBEvents() {
        eventBus.on(Events.INDEXEDDB_QUOTA_EXCEED_ERROR, stopRecord, instance);
        eventBus.on(Events.INDEXEDDB_INVALID_STATE_ERROR, stopRecord, instance);
    }

    /**
     *Boolean utilisé pour vérifier si le controlleur télécharge un stream.
     * @return {boolean}
     * @instance
    */
    function isRecording() {
        return isRecordingStatus;
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

    function onDownloadingStarted(e) {
        if (!e.error && manifestId !== null) {
            offlineStoreController.setDownloadingStatus(manifestId, e.status);
        } else {
            throw e.error;
        }
    }

    function onDownloadingFinished(e) {
        if (!e.error && manifestId !== null) {
            offlineStoreController.setDownloadingStatus(manifestId, e.status);
        } else {
            throw e.error;
        }
        resetRecord();
    }

    /**
     *Créé et compose un stream pour chaque type de streamInfo.
     * @instance
    */
    function composeStreams() {
        try {
            const streamsInfo = adapter.getStreamsInfo();
            if (streamsInfo.length === 0) {
                throw new Error('There are no streams');
            }
            for (let i = 0, ln = streamsInfo.length; i < ln; i++) {
                const streamInfo = streamsInfo[i];
                let stream = OfflineStream(context).create();
                stream.setConfig({
                    dashManifestModel: dashManifestModel,
                    adapter: adapter,
                    errHandler: errHandler,
                    baseURLController: baseURLController,
                    abrController: abrController
                });
                stream.initialize(streamInfo);
                streams.push(stream);
            }
            eventBus.trigger(Events.STREAMS_COMPOSED);
        } catch (e) {
            logger.info(e);
        }
    }
    //interception du fragment téléchargé puis stockage
    function storeFragment(e) {
        if (e.request !== null) {
            let fragmentName = e.request.representationId + '_' + e.request.index;
            offlineStoreController.storeFragment(fragmentName, e.response);
        }
    }

    /**
     * Créé une instance localforage pour stocker les nouveaux fragments du stream en BD.
     * @param {number} manifestId
     * @instance
    */
    function setFragmentStore(manifestId) {
        return offlineStoreController.setFragmentStore('manifest_' + manifestId);
    }

    /**
     * Stock dans le tableau de manifests le manifest compatible hors ligne.
     * @param {object} offlineManifest
     * @instance
    */
    function storeOfflineManifest(offlineManifest) {
        return offlineStoreController.storeOfflineManifest(offlineManifest);
    }

    /**
     * Evenement intercepté lorsque le manifest XML est téléchargé, dans le but de le rendre compatible hors ligne.
     * @param {Object[]} e
    */
    function onOriginalManifestLoaded(e) {
        eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, storeFragment, instance);
        XMLManifest = e.originalManifest;
    }

    /**
     * Initialise la qualité des mediaInfos remontée par l'utilisateur (bitrates).
     * @param {Object[]} allSelectedMediaInfos
     * @instance
    */
    function initializeAllMediasBitratesList(allSelectedMediaInfos) {
        for (let i = 0; i < streams.length; i++) {
            streams[i].initializeAllMediasBitratesList(allSelectedMediaInfos);
        }
    }

    /**
     * Initialise le store des fragment puis le manifest hors ligne avant d'initialiser les bandes passantes / téléchargement.
     * @param {Object[]} allSelectedMediaInfos
     * @instance
    */
    function initializeDownload(allSelectedMediaInfos) {
        try {
            generateManifestId().then(function (mId) {
                manifestId = mId;
                setFragmentStore(manifestId);
                generateOfflineManifest(XMLManifest, allSelectedMediaInfos, manifestId).then(function () {
                    initializeAllMediasBitratesList(allSelectedMediaInfos);
                });
            });
        } catch (err) {
            throw new Error(err);
        }
    }

    /**
     * Créer le parser chargé de convertir le manifest original en manifest hors ligne
     * Remonte un objet JSON contenant les informations à stocker en base de données
     * @param {string} XMLManifest
     * @param {Object[]} allSelectedMediaInfos
     * @param {number} manifestId
     * @instance
    */
    function generateOfflineManifest(XMLManifest, allSelectedMediaInfos, manifestId) {
        let parser = OfflineIndexDBManifestParser(context).create({
            allMediaInfos: allSelectedMediaInfos
        });

        return parser.parse(XMLManifest).then(function (parsedManifest) {
            if (parsedManifest !== null && manifestId !== null) {
                let offlineManifest = {
                    'fragmentStore': 'manifest_' + manifestId,
                    'status': 'created',
                    'manifestId': manifestId,
                    'url': 'offline_indexdb://' + manifestId,
                    'originalURL': manifest.url,
                    'manifest': parsedManifest
                };
                return storeOfflineManifest(offlineManifest);
            } else {
                return Promise.reject('falling parsing offline manifest');
            }
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    /**
     * Génère le manifestId du stream à partir du nombre de manifests
     * @returns {number}
     * @instance
    */
    function generateManifestId() {
        return offlineStoreController.getCurrentHigherManifestId().then(function (count) {
            return count + 1;
        });
    }

    /**
     * Remonte un tableau de manifests
     * @returns {array}
     * @instance
    */
    function getAllRecords() {
        return offlineStoreController.getAllManifests();
    }

    /**
     * Stop le téléchargement de fragmentq puis change l'état du stream en BD.
     * @instance
    */
    function stopRecord() {
        if (manifestId !== null && isRecording) {
            for (let i = 0, ln = streams.length; i < ln; i++) {
                streams[i].stopOfflineStreamProcessors();
            }
            offlineStoreController.setDownloadingStatus(manifestId, 'stopped');
            eventBus.trigger(Events.DOWNLOADING_STOPPED, {sender: this, status: 'stopped', message: 'Downloading has been stopped for this stream !'});
        }
    }

    /**
     * Supprime l'enregistrement du stream
     * @param {number} manifestId
     * @instance
    */
    function deleteRecord(manifestId) {

        if (streams.length >= 1) {
            stopRecord();
            isRecordingStatus = false;
        }
        return offlineStoreController.deleteRecordById(manifestId).then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    /**
     * Reprend le téléchargement d'un stream s'il y en a un en cours.
     * @instance
    */
    function resumeRecord() {
        if (isRecording()) {
            for (let i = 0, ln = streams.length; i < ln; i++) {
                streams[i].resumeOfflineStreamProcessors();
            }
        }
    }


    /**
     * Obtient le progression du nombre de fragments téléchargés.
     * @instance
    */
    function getRecordProgression() {
        let globalProgression = 0;
        for (let i = 0, ln = streams.length; i < ln; i++) {
            globalProgression = + streams[i].getRecordProgression();
        }
        return Math.round(globalProgression * 100);
    }

    /**
     * Reset les écouteurs d'évenements et des streams à la fin d'un téléchargement.
     * @instance
    */
    function resetRecord() {
        for (let i = 0, ln = streams.length; i < ln; i++) {
            streams[i].reset();
        }
        isRecordingStatus = false;
        streams = [];
        manifestId = null;
        eventBus.off(Events.FRAGMENT_LOADING_COMPLETED, storeFragment, instance);
        eventBus.off(Events.MANIFEST_UPDATED, onManifestUpdated, instance);
        eventBus.off(Events.ORIGINAL_MANIFEST_LOADED, onOriginalManifestLoaded, instance);
        resetOfflineEvents();
    }

    function resetOfflineEvents() {
        eventBus.off(Events.DOWNLOADING_STARTED, onDownloadingStarted, instance);
        eventBus.off(Events.DOWNLOADING_FINISHED, onDownloadingFinished, instance);
        resetIndexedDBEvents();
    }

    function resetIndexedDBEvents() {
        eventBus.off(Events.INDEXEDDB_QUOTA_EXCEED_ERROR, stopRecord, instance);
        eventBus.off(Events.INDEXEDDB_INVALID_STATE_ERROR, stopRecord, instance);
    }

    /**
     * Reset les dépendances de l'instance
     * @instance
    */
    function reset() {
        if (isRecording()) {
            resetRecord();
        }
        baseURLController.reset();
        manifestUpdater.reset();
        offlineStoreController = null;
    }

    instance = {
        record: record,
        onManifestUpdated: onManifestUpdated,
        setConfig: setConfig,
        composeStreams: composeStreams,
        initializeDownload: initializeDownload,
        stopRecord: stopRecord,
        resumeRecord: resumeRecord,
        deleteRecord: deleteRecord,
        getRecordProgression: getRecordProgression,
        getAllRecords: getAllRecords,
        isRecording: isRecording,
        reset: reset,
        resetRecord: resetRecord
    };

    setup();

    return instance;
}

OfflineController.__dashjs_factory_name = 'OfflineController';
export default FactoryMaker.getClassFactory(OfflineController);
