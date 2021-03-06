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
import Constants from './../../streaming/constants/Constants';
import FactoryMaker from './../../core/FactoryMaker';
import FragmentRequest from './../../streaming/vo/FragmentRequest';

/**
 * @module OfflineDownloaderRequestRule
 * @description Manages HTTP segments request.
 */
function OfflineDownloaderRequestRule() {


    let instance;

    /**
     * Génére des requêtes tant que la représentation n'est pas terminé.
     * Fonctionnement allégé du nextFragmmentRequestRule.
     * @param {object} OfflineStreamProcessor
     * @returns {request|null}
     * @instance
    */
    function execute(OfflineStreamProcessor) {
        const mediaInfo = OfflineStreamProcessor.getCurrentRepresentationInfo().mediaInfo;
        const mediaType = mediaInfo.type;
        const indexHandler = OfflineStreamProcessor.getIndexHandler();
        let time = indexHandler.getCurrentTime();
        let request;

        if (isNaN(time) || (mediaType === Constants.FRAGMENTED_TEXT)) {
            return null;
        }
        let representation = OfflineStreamProcessor.getRepresentation();
        request = indexHandler.getSegmentRequestForTime(representation, time);
        // Then, check if this request was downloaded or not
        while (request && request.action !== FragmentRequest.ACTION_COMPLETE  && OfflineStreamProcessor.getFragmentModel().isFragmentLoaded(request)) {
            // loop until we found not loaded fragment, or no fragment
            representation = OfflineStreamProcessor.getRepresentation();
            request = indexHandler ? indexHandler.getNextSegmentRequest(representation) : null;
        }
        if (request) {
            if (!isNaN(request.startTime + request.duration)) {
                indexHandler.setCurrentTime(request.startTime + request.duration);
            }
            request.delayLoadingTime = new Date().getTime();
        }
        return request;
    }

    instance = {
        execute: execute
    };


    return instance;
}

OfflineDownloaderRequestRule.__dashjs_factory_name = 'OfflineDownloaderRequestRule';
export default FactoryMaker.getClassFactory(OfflineDownloaderRequestRule);
