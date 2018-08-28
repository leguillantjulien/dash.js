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
import OfflineEvents from './../OfflineEvents';
import FactoryMaker from './../../core/FactoryMaker';
import Debug from './../../core/Debug';
import ManifestUpdater from './../../streaming/ManifestUpdater';
import BaseURLController from './../../streaming/controllers/BaseURLController';
import OfflineStoreController from './OfflineStoreController';
import OfflineStream from '../OfflineStream';
import OfflineIndexDBManifestParser from '../utils/OfflineIndexDBManifestParser';

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
        manifestUpdater.initialize();
    }

    function record(url) {
        eventBus.on(Events.MANIFEST_UPDATED, onManifestUpdated, instance);
        eventBus.on(Events.ORIGINAL_MANIFEST_LOADED, onOriginalManifestLoaded, instance);
        eventBus.on(Events.DOWNLOADING_STARTED, onDownloadingStarted, instance);
        eventBus.on(Events.DOWNLOADING_FINISHED, onDownloadingFinished, instance);
        manifestLoader.load(url);
        isRecordingStatus = true;
    }

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
        if (!e.error && e.status) {
            offlineStoreController.setDownloadingStatus(manifestId, e.status);
        }
    }

    function onDownloadingFinished(e) {
        if (!e.error && manifestId) {
            offlineStoreController.setDownloadingStatus(manifestId, e.status);
        }
        resetRecord();
    }

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

    function storeFragment(e) {
        if (e.request !== null) {
            let fragmentName = e.request.representationId + '_' + e.request.index;
            offlineStoreController.storeFragment(fragmentName, e.response);
        }
    }

    function setFragmentStore(manifestId) {
        return offlineStoreController.setFragmentStore('manifest_' + manifestId);
    }

    function storeOfflineManifest(encodedManifest) {
        offlineStoreController.storeOfflineManifest(encodedManifest);
    }

    function onOriginalManifestLoaded(e) {
            eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, storeFragment, instance);
            XMLManifest = e.originalManifest;
        }

    function initializeAllMediaBitrateList(allSelectedMediaInfos) {
        for (let i = 0; i < streams.length; i++) {
            streams[i].initializeAllMediaBitrateList(allSelectedMediaInfos);
        }
    }

    function initializeDownload(allSelectedMediaInfos) {
        try {
            generateManifestId().then(function (mId) {
                manifestId = mId;
                setFragmentStore(manifestId);
            }).then(function () {
                initializeAllMediaBitrateList(allSelectedMediaInfos);
                generateOfflineManifest(XMLManifest, allSelectedMediaInfos, manifestId);
            });
        } catch (err) {
            throw new Error(err);
        }
    }

    function generateOfflineManifest(XMLManifest, allSelectedMediaInfos, manifestId) {
        let parser = OfflineIndexDBManifestParser(context).create({
            allMediaInfos: allSelectedMediaInfos
        });

        parser.parse(XMLManifest).then(function (parsedManifest) {
            if (parsedManifest !== null && manifestId !== null) {
                let offlineManifest = {
                    'fragmentStore': 'manifest_' + manifestId,
                    'status': 'created',
                    'manifestId': manifestId,
                    'url': 'offline_indexdb://' + manifestId,
                    'originalURL': manifest.url,
                    'manifest': parsedManifest
                };
                storeOfflineManifest(offlineManifest);
            } else {
                throw new Error('falling parsing offline manifest');
            }
        });
    }

    function generateManifestId() {
        return offlineStoreController.countManifest().then(function (count) {
            return count + 1;
        });
    }

    function getAllRecords() {
        return offlineStoreController.getAllManifests();
    }

    function stopRecord() {
        if (manifestId !== null && isRecording) {
            for (let i = 0, ln = streams.length; i < ln; i++) {
                streams[i].stopOfflineStreamProcessors();
            }
            offlineStoreController.setDownloadingStatus(manifestId, 'stopped');
            eventBus.trigger(Events.DOWNLOADING_STOPPED, {sender: this, status: 'stopped', message: 'Downloading has been stopped for this stream !'});
        }
    }

    function deleteRecord(manifestId) {

        if (streams.length >= 1) {
            stopRecord();
            isRecordingStatus = false;
        }
        return offlineStoreController.deleteManifestById(manifestId).then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    function resumeRecord() {
        for (let i = 0, ln = streams.length; i < ln; i++) {
            streams[i].resumeOfflineStreamProcessors();
        }
        isRecordingStatus = true;
    }

    function getRecordProgression() {
        let globalProgression = 0;
        for (let i = 0, ln = streams.length; i < ln; i++) {
            globalProgression = + streams[i].getRecordProgression();
        }
        return Math.round(globalProgression * 100);
    }

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
        eventBus.off(Events.DOWNLOADING_STARTED, onDownloadingStarted, instance);
        eventBus.off(Events.DOWNLOADING_FINISHED, onDownloadingFinished, instance);
    }

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
