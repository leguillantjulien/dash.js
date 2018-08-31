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
import MetricsModel from './../streaming/models/MetricsModel';
import TimelineConverter from './../dash/utils/TimelineConverter';

/**
 * @module  OfflineStreamProcessor
 * @description Arrange downloading for each type
 */
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
        mediaInfo,
        abrController,
        updating,
        currentVoRepresentation,
        offlineDownloaderRequestRule,
        downloadedSegments,
        isInitialized,
        representation,
        isStopped,
        stream,
        qualityIndex;

    function setConfig(config) {

        if (!config) return;

        if (config.type) {
            type = config.type;
        }

        if (config.stream) {
            stream = config.stream;
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

        if (config.adapter) {
            adapter = config.adapter;
        }

        if (config.baseURLController) {
            baseURLController = config.baseURLController;
        }

        if (config.abrController) {
            abrController = config.abrController;
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
    }

    /**
     * Pause temporairement le téléchargement de fragments
     * @memberof OfflineStreamProcessor#
     */
    function stop() {
        if (isStopped) {
            return;
        }
        isStopped = true;
    }

    /**
     * Redémarre le téléchargement de fragments la ou l'OfflineStreamProcessor c'est arrêté
     * @memberof OfflineStreamProcessor#
     */
    function resume() {
        isStopped = false;
        download();
    }

    /**
     * Créer les dépendances et initialise l'OfflineStreamProcessor
     * @memberof OfflineStreamProcessor#
    */
    function initialize() {

        indexHandler = DashHandler(context).create({
            mimeType: mimeType,
            baseURLController: baseURLController,
            metricsModel: MetricsModel(context).getInstance(),
            errHandler: errHandler,
            timelineConverter:  TimelineConverter(context).getInstance()
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

    //repris du streamProcessor
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

    function updateData() {
        const voAdaptation = adapter.getDataForMedia(mediaInfo);
        if (voAdaptation) {
            updateRepresentation(voAdaptation, type);
        } else {
            throw new Error('Any Vo Periods for this streamInfo');
        }
    }

    /**
     * Créer et exécute la première requête de la représentation
     * @memberof OfflineStreamProcessor#
    */
    function getInitRequest() {
        if (!representation) return null;
        let initRequest = indexHandler.getInitRequest(representation);
        return fragmentModel.executeRequest(initRequest);
    }


    /**
     * Méthode appelée pour démarrer le téléchargement si une représentation existe.
     * @memberof OfflineStreamProcessor#
    */
    function start() {
        if (!currentVoRepresentation) {
            throw new Error('Start denied to OfflineStreamProcessor');
        }
        isStopped = false;
        download();
    }

    /**
     * Téléchargement des fragments associés au type du OfflineStreamProcessor
     * @memberof OfflineStreamProcessor#
    */
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
    }

    /**
     * Téléchargement des fragments associés au type du OfflineStreamProcessor
     * @param {Object} voAdaptation - adaptation
     * @param {string} type du média
     * @memberof OfflineStreamProcessor#
    */
    function updateRepresentation(voAdaptation, type) {
        const streamInfo = getStreamInfo();
        //Si l'index de qualité n'est pas défini on télécharge par défaut à la meilleur qualité du streamInfo
        if (qualityIndex === null) {
            qualityIndex = abrController.getTopQualityIndexFor(type, streamInfo.id);
        }
        updating = true;

        let voRepresentations = dashManifestModel.getRepresentationsForAdaptation(voAdaptation);
        currentVoRepresentation = voRepresentations[qualityIndex] !== undefined ? voRepresentations[qualityIndex] : voRepresentations[voRepresentations.length - 1];

        if (type !== Constants.VIDEO && type !== Constants.AUDIO  && type !== Constants.TEXT && type !== Constants.FRAGMENTED_TEXT) {
            updating = false;
            return;
        }

        indexHandler.updateRepresentation(currentVoRepresentation, true); //update uniquement la représentation pour la qualité choisie
    }

    //Evenement intercepté lorsque la représentation est prête
    function onRepresentationUpdated(e) {
        if (e.sender.getStreamProcessor() !== instance || !isUpdating()) return;

        representation = e.representation;
        eventBus.trigger(Events.DATA_UPDATE_COMPLETED, {sender: this, currentRepresentation: currentVoRepresentation});
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
        return getRepresentation().availableSegmentsNumber;
    }

    function getDownloadedSegments() {
        return downloadedSegments;
    }

    function resetInitialSettings() {
        isInitialized = false;
        qualityIndex = null;
        downloadedSegments = 0;
        mimeType = null;
        mediaInfo = null;
        updating = false;
        currentVoRepresentation = NaN;
        downloadedSegments = null;
        representation = null;
        type = null;
        stream = null;
    }

    /**
     * Reset des écouteurs d'évenement et des dépendances
     * @memberof OfflineStreamProcessor#
    */
    function reset() {
        resetInitialSettings();
        indexHandler.reset();
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
        getStreamProcessor: getStreamProcessor,
        start: start,
        stop: stop,
        resume: resume,
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