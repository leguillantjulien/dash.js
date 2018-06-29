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
import DashJSError from '../../streaming/vo/DashJSError';

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
        offlineController,
        timelineConverter,
        mediaInfo,
        mediaInfoArr,
        abrController,
        updating,
        rulesContext,
        voAvailableRepresentations,
        realAdaptationIndex,
        realAdaptation,
        currentVoRepresentation,
        abrRulesCollection,
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

        if (config.offlineController) {
            offlineController = config.offlineController;
        }

    }

    function setup() {
        mediaInfoArr = [];
        voAvailableRepresentations = [];
        logger = Debug(context).getInstance().getLogger(instance);
        eventBus = EventBus(context).getInstance();
        eventBus.on(Events.FRAGMENT_COMPLETED, storeFragment, instance);
        eventBus.on(Events.STREAM_COMPLETED, createOfflineManifest, instance);
        eventBus.on(Events.REPRESENTATION_UPDATED, onRepresentationUpdated, instance);
        eventBus.on(Events.FRAGMENT_COMPLETED, fragmentCompleted, instance);

    }

    function getStreamProcessor(){
        return instance;
    }
    function storeFragment(e) {
        logger.info('OnFragmentLoadingCompleted - Url:', e.request ? e.request.url : 'undefined');
        logger.info('storeFragment');
        logger.info(JSON.stringify(e));
    }

    function createOfflineManifest(e) {
        logger.info('createOfflineManifest');
        logger.info(JSON.stringify(e));
    }

    function fragmentCompleted(e){
        console.log('fragmentCompleted',e)
    }

    function initialize() {

        indexHandler = DashHandler(context).create({
            mimeType: mimeType,
            baseURLController: baseURLController,
            errHandler: errHandler,
            timelineConverter: timelineConverter
        });
        indexHandler.initialize(instance);
        abrController.registerStreamType(type, instance);

        fragmentModel = stream.getFragmentController().getModel(type);
        fragmentModel.setStreamProcessor(instance);
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

    function start() {
        console.log('start')
        let nextFragment,
            request;
        console.log('currentVoRepresentation', currentVoRepresentation);
        let r2 = indexHandler.getInitRequest(currentVoRepresentation)
        console.log(r2);
        nextFragment = getNextFragment(currentVoRepresentation);
        console.log('nextFragment', nextFragment);

        request = indexHandler.getNextSegmentRequest(currentVoRepresentation);
        console.log(request);
        logger.debug('getNextFragment - request is ' + request.url);
        fragmentModel.executeRequest(request);
    }

    function updateRepresentation(newRealAdaptation, voAdaptation, type) {
        const streamInfo = getStreamInfo();
        const maxQuality = abrController.getTopQualityIndexFor(type, streamInfo.id);
        console.log('maxQuality', maxQuality);

        updating = true;
        eventBus.trigger(Events.DATA_UPDATE_STARTED, {sender: this});

        voAvailableRepresentations = updateRepresentations(voAdaptation);
        currentVoRepresentation = getRepresentationForQuality(maxQuality);
        console.log('currentVoRepresentation', currentVoRepresentation);
        realAdaptation = newRealAdaptation;
        console.log('realAdaptation', realAdaptation);
        if (type !== Constants.VIDEO && type !== Constants.AUDIO && type !== Constants.FRAGMENTED_TEXT) {
            updating = false;
            console.log('DATA_UPDATE_COMPLETED');
            eventBus.trigger(Events.DATA_UPDATE_COMPLETED, {sender: this, data: realAdaptation, currentRepresentation: currentVoRepresentation});
            return;
        }

        indexHandler.updateRepresentation(currentVoRepresentation, true); //Update only for the best Representation
    }

    function onRepresentationUpdated(e) {
        console.log('onRepresentationUpdated', e);
        if (e.sender.getStreamProcessor() !== instance || !isUpdating()) return;

        let r = e.representation;
        console.log('r : ', r);

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
        return currentVoRepresentation;
    }

    function getRepresentationInfoForQuality(quality) {
        console.log('getRepresentationInfoForQuality',quality)
        return getRepresentationInfoForQuality(representationController, quality);
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

    function getNextFragment(representation) {
        console.log('getNextFragment', representation);
        return indexHandler ? indexHandler.getNextSegmentRequest(representation) : null;
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
        getNextFragment: getNextFragment,
        getStreamProcessor: getStreamProcessor,
        start: start
    };

    setup();

    return instance;
}
OfflineStreamDownloader.__dashjs_factory_name = 'OfflineStreamDownloader';
const factory = FactoryMaker.getClassFactory(OfflineStreamDownloader);
export default factory;