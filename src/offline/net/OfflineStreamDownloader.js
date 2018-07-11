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
import Debug from './../../core/Debug';
import Events from './../../core/events/Events';
import FactoryMaker from './../../core/FactoryMaker';
import DashHandler from './../../dash/DashHandler';
import Constants from './../../streaming/constants/Constants';
import Representation from './../../dash/vo/Representation';
import DashConstants from '../../dash/constants/DashConstants';
import OfflineDownloaderRequestRule from './../rules/OfflineDownloaderRequestRule';
import FragmentModel from './../../streaming/models/FragmentModel';
import RequestModifier from './../../streaming/utils/RequestModifier';

function OfflineStreamDownloader(config) {

    config = config || {};
    let context = this.context;

    let instance,
        adapter,
        logger,
        indexHandler,
        type,
        errHandler,
        eventBus,
        mimeType,
        manifestModel,
        baseURLController,
        fragmentModel,
        dashManifestModel,
        timelineConverter,
        mediaInfo,
        mediaInfoArr,
        abrController,
        updating,
        voAvailableRepresentations,
        realAdaptationIndex,
        realAdaptation,
        currentVoRepresentation,
        offlineDownloaderRequestRule,
        metricsModel,
        voRepresentation,
        requestModifier,
        replaceRequestArray,
        downloaderTimeout,
        isInitialized,
        maxQuality,
        representation,
        stream;

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

        if (config.timelineConverter) {
            timelineConverter = config.timelineConverter;
        }

        if (config.adapter) {
            adapter = config.adapter;
        }

        if (config.manifestModel) {
            manifestModel = config.manifestModel;
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

        if (config.fragmentModel) {
            fragmentModel = config.fragmentModel;
        }

    }

    function setup() {
        mediaInfoArr = [];
        voAvailableRepresentations = [];
        replaceRequestArray = [];
        isInitialized = false;
        maxQuality = null;
        logger = Debug(context).getInstance().getLogger(instance);
        eventBus = EventBus(context).getInstance();
        eventBus.on(Events.STREAM_COMPLETED, createOfflineManifest, instance);
        eventBus.on(Events.REPRESENTATION_UPDATED, onRepresentationUpdated, instance);
        eventBus.on(Events.FRAGMENT_LOADING_COMPLETED, onFragmentLoadingCompleted, instance);

    }


    function onFragmentLoadingCompleted(e) {
        if (e.sender !== fragmentModel) {
            return;
        }
        logger.info('OnFragmentLoadingCompleted - Url:', e.request ? e.request.url : 'undefined');

        if (e.error && e.request.serviceLocation) { //TODO add !isStopped
            logger.info(e.request);
            replaceRequest(e.request);
            startDownloaderTimer(500);
        }

        eventBus.trigger(Events.FRAGMENT_COMPLETED, { //use for offlineController EVENT
            request: e.request,
            response: e.response
        });
    }

    function getStreamProcessor() {
        return instance;
    }

    function createOfflineManifest(e) {
        logger.info('createOfflineManifest');
        logger.info(JSON.stringify(e));
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
        abrController.registerStreamType(type, instance);

        fragmentModel = getFragmentController().getModel(type);
        fragmentModel.setStreamProcessor(instance);

        offlineDownloaderRequestRule = OfflineDownloaderRequestRule(context).create({
            adapter: adapter
        });

        requestModifier = RequestModifier(context).getInstance();
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
        if (mediaInfoArr.indexOf(newMediaInfo) === -1) {
            mediaInfoArr.push(newMediaInfo);
        }

        if (selectNewMediaInfo) {
            this.selectMediaInfo(newMediaInfo);
        }
    }

    function getMediaInfoArr() {
        return mediaInfoArr;
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
        }

    }

    function getInitRequest() {
        let initRequest = indexHandler.getInitRequest(representation);
        console.log('initRequest', initRequest);
        return Promise.resolve(fragmentModel.executeRequest(initRequest));
    }

    function validateExecutedFragmentRequest() {
        // Validate that the fragment request executed and appended into the source buffer is as
        // good of quality as the current quality and is the correct media track.
        const request = fragmentModel.getRequests({
            state: FragmentModel.FRAGMENT_MODEL_EXECUTED,
            threshold: 0
        })[0];
        console.log('validateExecutedFragmentRequest');
        if (request && replaceRequestArray.indexOf(request) === -1 && !dashManifestModel.getIsTextTrack(type)) {
            replaceRequest(request);
        }
    }

    function replaceRequest(request) {
        replaceRequestArray.push(request);
    }

    function timeIsBuffered(time) {
        if (time !== undefined) {

            return true;
        }
    }

    function start() {
        startDownloaderTimer(1500);

        validateExecutedFragmentRequest();
        const isReplacement = replaceRequestArray.length > 0;

        if (isReplacement || isNaN(currentVoRepresentation.quality)) {
            const getNextFragment = function () {
                logger.info('isInitialized', isInitialized);
                if (!isInitialized) {
                    getInitRequest().then(function () {
                        isInitialized = true;
                    }).catch(function () {
                        throw new Error('Cannot initialize first request');
                    });
                } else {
                    const replacement = replaceRequestArray.shift();
                    logger.info('replacement', replacement);

                    let request = offlineDownloaderRequestRule.execute(instance, replacement);

                    if (request) {
                        logger.info('getNextFragment - request is ' + request.url);
                        fragmentModel.executeRequest(request);
                    } else {
                        startDownloaderTimer(1000);
                    }
                }
            };
            getNextFragment();
        } else {
            startDownloaderTimer(1000);
        }
    }

    function startDownloaderTimer(value) {
        clearTimeout(downloaderTimeout);
        downloaderTimeout = setTimeout(start, value);
    }

    function getRepresentationForRepresentationInfo(representationInfo) {
        return getRepresentationForQuality(representationInfo.quality);
    }

    function updateRepresentation(newRealAdaptation, voAdaptation, type) {
        const streamInfo = getStreamInfo();
        maxQuality = abrController.getTopQualityIndexFor(type, streamInfo.id);

        updating = true;
        eventBus.trigger(Events.DATA_UPDATE_STARTED, {sender: this});

        voAvailableRepresentations = updateRepresentations(voAdaptation);
        currentVoRepresentation = getRepresentationForQuality(maxQuality);
        realAdaptation = newRealAdaptation;
        if (type !== Constants.VIDEO && type !== Constants.AUDIO && type !== Constants.FRAGMENTED_TEXT) {
            updating = false;
            eventBus.trigger(Events.DATA_UPDATE_COMPLETED, {sender: this, data: realAdaptation, currentRepresentation: currentVoRepresentation});
            return;
        }

        indexHandler.updateRepresentation(currentVoRepresentation, true); //Update only for the best Representation
    }

    function onRepresentationUpdated(e) {
        if (e.sender.getStreamProcessor() !== instance || !isUpdating()) return;

        representation = e.representation;

        if (isAllRepresentationsUpdated()) {
            updating = false;
        }
        eventBus.trigger(Events.DATA_UPDATE_COMPLETED, {sender: this, data: realAdaptation, currentRepresentation: currentVoRepresentation});
    }

    function isAllRepresentationsUpdated() {
        for (let i = 0, ln = voAvailableRepresentations.length; i < ln; i++) {
            let segmentInfoType = voAvailableRepresentations[i].segmentInfoType;
            if (voAvailableRepresentations[i].segmentAvailabilityRange === null || !Representation.hasInitialization(voAvailableRepresentations[i]) ||
                ((segmentInfoType === DashConstants.SEGMENT_BASE || segmentInfoType === DashConstants.BASE_URL) && !voAvailableRepresentations[i].segments)
            ) {
                return false;
            }
        }

        return true;
    }

    function getQualityForRepresentation(voRepresentation) {
        return voAvailableRepresentations.indexOf(voRepresentation);
    }

    function updateRepresentations(voAdaptation) {
        let voReps;

        realAdaptationIndex = dashManifestModel.getIndexForAdaptation(realAdaptation, voAdaptation.period.mpd.manifest, voAdaptation.period.index);
        voReps = dashManifestModel.getRepresentationsForAdaptation(voAdaptation);

        return voReps;
    }

    function getRepresentationForQuality(quality) {
        return voAvailableRepresentations[quality];
    }

    function getCurrentRepresentationInfo() {
        return currentVoRepresentation ? adapter.convertDataToRepresentationInfo(currentVoRepresentation) : null;
    }

    function getRepresentationInfoForQuality(quality) {
        voRepresentation = getRepresentationForQuality(quality);
        return voRepresentation ? adapter.convertDataToRepresentationInfo(voRepresentation) : null;
    }

    function getStreamInfo() {
        return stream ? stream.getStreamInfo() : null;
    }

    function isUpdating() {
        console.log('updating', updating);
        return updating;
    }

    function getType() {
        return type;
    }

    function getMediaInfo() {
        return mediaInfo;
    }

    instance = {
        initialize: initialize,
        setConfig: setConfig,
        getIndexHandler: getIndexHandler,
        addMediaInfo: addMediaInfo,
        getCurrentRepresentationInfo: getCurrentRepresentationInfo,
        getRepresentationInfoForQuality: getRepresentationInfoForQuality,
        selectMediaInfo: selectMediaInfo,
        getFragmentController: getFragmentController,
        getFragmentModel: getFragmentModel,
        getStreamInfo: getStreamInfo,
        getMediaInfo: getMediaInfo,
        getMediaInfoArr: getMediaInfoArr,
        getType: getType,
        isUpdating: isUpdating,
        getRepresentationForQuality: getRepresentationForQuality,
        getPeriodForStreamInfo: getPeriodForStreamInfo,
        getStreamProcessor: getStreamProcessor,
        getQualityForRepresentation: getQualityForRepresentation,
        getRepresentationForRepresentationInfo: getRepresentationForRepresentationInfo,
        start: start,
        timeIsBuffered: timeIsBuffered
    };

    setup();

    return instance;
}
OfflineStreamDownloader.__dashjs_factory_name = 'OfflineStreamDownloader';
const factory = FactoryMaker.getClassFactory(OfflineStreamDownloader);
export default factory;