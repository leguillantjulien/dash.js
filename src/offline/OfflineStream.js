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
import OfflineEvents from './events/OfflineEvents';
import FactoryMaker from './../core/FactoryMaker';
import Debug from './../core/Debug';
import MetricsModel from './../streaming/models/MetricsModel';
import FragmentController from './../streaming/controllers/FragmentController';
import OfflineStreamProcessor from './OfflineStreamProcessor';
import Constants from './../streaming/constants/Constants';
import RequestModifier from './../streaming/utils/RequestModifier';

/**
 * @module  OfflineStream
 * @description Initialize and Manage Stream for each type
 * @param {Object} config - dependences
 */
function OfflineStream(config) {

    config = config || {};
    const context = this.context;
    const eventBus = EventBus(context).getInstance();

    let instance,
        adapter,
        abrController,
        baseURLController,
        dashManifestModel,
        offlineStreamProcessor,
        offlineStreamProcessors,
        startedOfflineStreamProcessors,
        finishedOfflineStreamProcessors,
        errHandler,
        streamInfo,
        fragmentController,
        availableSegments,
        allMediasBitratesList,
        logger;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        resetInitialSettings();
        Events.extend(OfflineEvents);
    }

    /**
     * Reset les variables du OfflineStream
     */
    function resetInitialSettings() {
        offlineStreamProcessors = [];
        availableSegments = 0;
        streamInfo = null;
        offlineStreamProcessors = [];
        startedOfflineStreamProcessors = 0;
        finishedOfflineStreamProcessors = 0;
        allMediasBitratesList = [];
    }

    function setConfig(config) {
        if (!config) return;

        if (config.dashManifestModel) {
            dashManifestModel = config.dashManifestModel;
        }

        if (config.adapter) {
            adapter = config.adapter;
        }

        if (config.errHandler) {
            errHandler = config.errHandler;
        }

        if (config.abrController) {
            abrController = config.abrController;
        }

        if (config.baseURLController) {
            baseURLController = config.baseURLController;
        }

    }

    /**
     * Initialise le streamInfo ainsi que les dépendences de l'OfflineStream
     * @param {Object} initStreamInfo
     */
    function initialize(initStreamInfo) {
        streamInfo = initStreamInfo;
        fragmentController = FragmentController(context).create({
            errHandler: errHandler,
            metricsModel: MetricsModel(context).getInstance(),
            requestModifier: RequestModifier(context).getInstance()
        });
        getMediaBitrate(streamInfo);
        setAvailableSegments();
        eventBus.on(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
        eventBus.on(Events.STREAM_COMPLETED, onStreamCompleted, this);
    }

    /**
     * Créer la liste des bandes passantes de chaque type du streamInfo
     * @param {Object} streamInfo
     */
    function getMediaBitrate(streamInfo) {
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

    /**
     * Retourne la liste des bandes passantes pour le type passé en paramètre
     * @param {string} type
     * @param {Object} streamInfo
     */
    function getBitrateListForType(type, streamInfo) {
        const allMediaForType =  adapter.getAllMediaInfoForType(streamInfo, type);
        let mediaInfo = getMediaInfoForType(type, allMediaForType);
        return abrController.getBitrateList(mediaInfo);
    }

    /**
     * initialise le stream avec les bandes passantes choisies par l'utilisateur
     * @param {Object} mediasBitratesList
     */
    function initializeAllMediasBitratesList(mediasBitratesList) {
        allMediasBitratesList = mediasBitratesList;
        initializeMedia(streamInfo);
        setAvailableSegments();
    }

    /**
     * initialise le média pour chaque type
     * @param {Object} streamInfo
     */
    function initializeMedia(streamInfo) {
        initializeMediaForType(Constants.VIDEO,streamInfo);
        initializeMediaForType(Constants.AUDIO,streamInfo);
        initializeMediaForType(Constants.TEXT,streamInfo);
        initializeMediaForType(Constants.FRAGMENTED_TEXT,streamInfo);
        initializeMediaForType(Constants.EMBEDDED_TEXT,streamInfo);
        initializeMediaForType(Constants.MUXED,streamInfo);
        initializeMediaForType(Constants.IMAGE,streamInfo);
    }

    /**
     * Créer un offlineStreamProcessor si le type existe dans le streamInfo
     * @param {string} type
     * @param {Object} streamInfo
     */
    function initializeMediaForType(type, streamInfo) {
        const allMediaForType = adapter.getAllMediaInfoForType(streamInfo, type);
        let mediaInfo = getMediaInfoForType(type, allMediaForType);
        if (mediaInfo !== null) {
            mediaInfo = assignBitratesForMedia(type, mediaInfo);
            createOfflineStreamProcessor(mediaInfo, allMediaForType);
        }

    }

    function assignBitratesForMedia(type, mediaInfo) {
        let bitrateForType = getBitrateForType(type);
        if (bitrateForType !== null) {
            mediaInfo.bitrateList = bitrateForType;
        }
        return mediaInfo;
    }
    /**
     * Retourne le bitrate correspondant au type du mediaInfo
     * @param {string} type
     * @returns {number|null} bitrateForType
     */
    function getBitrateForType(type) {
        let currentMediaBitrate,
            bitrateForType;

        bitrateForType = null;
        for (let i = 0; i < allMediasBitratesList.length; i++) {
            currentMediaBitrate = JSON.parse(allMediasBitratesList[i]);
            if (type == currentMediaBitrate.mediaType) {
                bitrateForType = currentMediaBitrate;
            }
        }
        return bitrateForType;
    }

    /**
     * Retourne le mediaInfo correspondant au type s'il existe
     * @param {string} type
     * @param {Array} allMediaForType
     * @returns {Object|null} mediaInfo
     */
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

    /**
     * Retourne le fragmentController de l'instance
     * Utilisé par le OfflineStreamProcessor
     */
    function getFragmentController() {
        return fragmentController;
    }

    /**
     * Création du streamProcessor en charge d'ordonner et de télécharger les fragments pour un type de média
     * @param {Object} mediaInfo
     * @param {Array} allMediaForType
     * @param {Object} optionalSettings
     */
    function createOfflineStreamProcessor(mediaInfo, allMediaForType, optionalSettings) {
        offlineStreamProcessor = OfflineStreamProcessor(context).create();
        offlineStreamProcessor.setConfig({
            type: mediaInfo.type,
            mimeType: mediaInfo.mimeType,
            qualityIndex: mediaInfo.bitrateList ? mediaInfo.bitrateList.qualityIndex : null,
            adapter: adapter,
            dashManifestModel: dashManifestModel,
            baseURLController: baseURLController,
            errHandler: errHandler,
            stream: instance,
            abrController: abrController
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

    /**
     * Déclenche un évenement lors la totalité des offlineStreamProcessors ont fini
     */
    function onStreamCompleted() {
        finishedOfflineStreamProcessors++;
        if (finishedOfflineStreamProcessors === offlineStreamProcessors.length) {
            eventBus.trigger(Events.DOWNLOADING_FINISHED, {sender: this, status: 'finished', message: 'Downloading has been successfully completed for this stream !'});
        }
    }

    function onDataUpdateCompleted(e) {
        let sp = e.sender.getStreamProcessor();
        if (sp.getStreamInfo() !== streamInfo) {
            return;
        }

        sp.start();
        checkIfAllOfflineStreamProcessorsStarted();
    }

    function checkIfAllOfflineStreamProcessorsStarted() {
        startedOfflineStreamProcessors++;
        if (startedOfflineStreamProcessors === offlineStreamProcessors.length) {
            eventBus.trigger(Events.DOWNLOADING_STARTED, {sender: this, status: 'started', message: 'Downloading has been successfully started for this stream !'});
        }
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

    /**
     * Stop le téléchargement de fragments de chaque processor
     */
    function stopOfflineStreamProcessors() {
        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            offlineStreamProcessors[i].stop();
        }
    }

    /**
     * Reprend le téléchargement de fragments de chaque processor
     */
    function resumeOfflineStreamProcessors() {
        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            offlineStreamProcessors[i].resume();
        }
    }

    /**
     * Retourne le nombre de segments téléchargés / nombre total de segments
     * @returns {number} recordProgression
     */
    function getRecordProgression() {
        let getDownloadedSegments = 0;

        for (let i = 0; i < offlineStreamProcessors.length; i++) {
            getDownloadedSegments = getDownloadedSegments + offlineStreamProcessors[i].getDownloadedSegments();
        }
        return getDownloadedSegments / availableSegments;
    }

    /**
     * Initialise le nombre total de segments du streamInfo
     */
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

    /**
     * Reset certains composants de l'OfflineStream
     */
    function deactivate() {
        let ln = offlineStreamProcessors ? offlineStreamProcessors.length : 0;
        for (let i = 0; i < ln; i++) {
            let fragmentModel = offlineStreamProcessors[i].getFragmentModel();
            fragmentModel.removeExecutedRequestsBeforeTime(getStartTime() + getDuration());
            offlineStreamProcessors[i].reset();
        }
    }

    /**
     * Reset la totalité de l'OfflineStream
     */
    function reset() {
        stopOfflineStreamProcessors();
        if (fragmentController) {
            fragmentController.reset();
            fragmentController = null;
        }
        deactivate();
        resetInitialSettings();

        eventBus.off(Events.DATA_UPDATE_COMPLETED, onDataUpdateCompleted, this);
    }

    instance = {
        initialize: initialize,
        setConfig: setConfig,
        initializeAllMediasBitratesList: initializeAllMediasBitratesList,
        offlineStreamProcessor: offlineStreamProcessor,
        getFragmentController: getFragmentController,
        getStreamInfo: getStreamInfo,
        stopOfflineStreamProcessors: stopOfflineStreamProcessors,
        resumeOfflineStreamProcessors: resumeOfflineStreamProcessors,
        getRecordProgression: getRecordProgression,
        setAvailableSegments: setAvailableSegments,
        reset: reset
    };

    setup();
    return instance;
}

OfflineStream.__dashjs_factory_name = 'OfflineStream';
export default FactoryMaker.getClassFactory(OfflineStream);
