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
import FactoryMaker from './../../core/FactoryMaker';
import Debug from './../../core/Debug';
import URLUtils from './../../streaming/utils/URLUtils';

const Entities = require('html-entities').XmlEntities;
const ELEMENT_TYPE_MPD = 'MPD';
const ELEMENT_TYPE_PERIOD = 'Period';
const ELEMENT_TYPE_BaseURL = 'BaseURL';
const ELEMENT_TYPE_ADAPTATIONSET = 'AdaptationSet';
const ELEMENT_TYPE_SEGMENT_TEMPLATE = 'SegmentTemplate';
const ELEMENT_TYPE_REPRESENTATION = 'Representation';
const ATTRIBUTE_TYPE_ID = 'id';
const ATTRIBUTE_TYPE_BANDWITH = 'bandwidth';
const OFFLINE_BASE_URL = 'offline_indexdb://'
function OfflineIndexDBManifestParser(config) {
    const context = this.context;
    const allMediaInfos = config.allMediaInfos;

    let instance,
        DOM,
        urlUtils,
        logger;


    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        urlUtils = URLUtils(context).getInstance();
    }

    function parse(XMLDoc) {
        DOM = new DOMParser().parseFromString(XMLDoc, 'application/xml');
        let mpd = DOM.getElementsByTagName(ELEMENT_TYPE_MPD) ? DOM.getElementsByTagName(ELEMENT_TYPE_MPD) : null;

        for (let i = 0; i < mpd.length; i++) {
            if (mpd[i] !== null) {
                editBaseURLAttribute(mpd[i]);
                browsePeriods(mpd[i]);
            }
        }
        //TODO : remove promise timeOut
        return wait(1000).then(function () {
            return encodeManifest(DOM);
        });
    }

    function encodeManifest(DOM) {
        logger.info('encodedManifest ' + new XMLSerializer().serializeToString(DOM));
        return new Entities().encode(new XMLSerializer().serializeToString(DOM));
    }

    function editBaseURLAttribute(currentMPD) {
        let basesURL,
            fragmentId,
            representationId;

        basesURL = currentMPD.getElementsByTagName(ELEMENT_TYPE_BaseURL);
        for (let i = 0; i < basesURL.length; i++) {
            let parent = basesURL[i].parentNode;

            if (parent.nodeName === ELEMENT_TYPE_MPD) {
                basesURL[i].innerHTML = OFFLINE_BASE_URL;
            } else if (parent.nodeName === ELEMENT_TYPE_REPRESENTATION) {
                let adaptationsSet = parent.parentNode;
                if (adaptationsSet.nodeName == ELEMENT_TYPE_ADAPTATIONSET) {

                    if (urlUtils.isHTTPS(basesURL[i].innerHTML) || urlUtils.isHTTPURL(basesURL[i].innerHTML)) {
                        fragmentId = getFragmentId(basesURL[i].innerHTML);
                        representationId = getBestRepresentationId(adaptationsSet);
                        basesURL[i].innerHTML = OFFLINE_BASE_URL + representationId + '_' + fragmentId;
                    } else if (basesURL[i].innerHTML === './') {
                        basesURL[i].innerHTML = OFFLINE_BASE_URL;
                    } else {
                        fragmentId = getFragmentId(basesURL[i].innerHTML);
                        representationId = getBestRepresentationId(adaptationsSet);
                        basesURL[i].innerHTML = representationId + '_' + fragmentId;
                    }
                }
            } else {
                basesURL[i].innerHTML = OFFLINE_BASE_URL;
            }
        }
    }

    function browsePeriods(currentMPD) {
        let periods = currentMPD.getElementsByTagName(ELEMENT_TYPE_PERIOD);
        for (let j = 0; j < periods.length; j++) {
            browseAdaptationsSet(periods[j]);
        }
    }

    function browseAdaptationsSet(currentPeriod) {
        let adaptationsSet,
            currentAdaptationSet,
            currentAdaptationType,
            bitrate,
            representations;

        adaptationsSet = currentPeriod.getElementsByTagName(ELEMENT_TYPE_ADAPTATIONSET);

        for (let i = 0; i < adaptationsSet.length; i++) {
            currentAdaptationSet = adaptationsSet[i];
            if (currentAdaptationSet) {
                currentAdaptationType = findAdaptationType(currentAdaptationSet);
                representations = findRepresentations(currentAdaptationSet);
                bitrate = findBitrateForAdaptationSetType(currentAdaptationType);

                if (representations.length >= 1 && bitrate !== null) {
                    findAndKeepOnlySelectedBitrateRepresentation(currentAdaptationSet, representations, bitrate);
                } else {
                    findAndKeepOnlyBestRepresentation(currentAdaptationSet, representations);
                }
                let segmentTemplate = getSegmentTemplate(currentAdaptationSet);
                if (segmentTemplate.length >= 1) {
                    editSegmentTemplateAttributes(segmentTemplate);
                }
            }
        }
    }

    function findAdaptationType(currentAdaptationSet) {
        if (findAdaptationSetContentType(currentAdaptationSet) !== null) {
            return findAdaptationSetContentType(currentAdaptationSet);
        } else if (findAdaptationSetMimeType(currentAdaptationSet) !== null) {
            let mimeType = findAdaptationSetMimeType(currentAdaptationSet);
            return mimeType.substring(0, mimeType.indexOf('/'));
        } else {
            return null;
        }
    }

    function findBitrateForAdaptationSetType(type) {
        let bitrate = null;

        for (let i = 0; i < allMediaInfos.length; i++) {
            let currentMediaInfo = JSON.parse(allMediaInfos[i]);
            if (currentMediaInfo.mediaType === type) {
                bitrate = currentMediaInfo.bitrate;
            }
        }
        return bitrate;
    }

    function findAdaptationSetContentType(currentAdaptationSet) {
        return currentAdaptationSet.getAttribute('contentType');
    }

    function findAdaptationSetMimeType(currentAdaptationSet) {
        return currentAdaptationSet.getAttribute('mimeType');
    }

    function findRepresentations(currentAdaptationSet) {
        return currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION);
    }

    function getSegmentTemplate(currentAdaptationSet) {
        return currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_SEGMENT_TEMPLATE);
    }

    function editSegmentTemplateAttributes(segmentsTemplates) {
        for (let i = 0; i < segmentsTemplates.length; i++) {
            let media = segmentsTemplates[i].getAttribute('media');
            media = '$RepresentationID$_$Number$' + media.substring(media.indexOf('.'), media.length); //id + extension
            segmentsTemplates[i].setAttribute('startNumber', '1');
            segmentsTemplates[i].setAttribute('media', media);
            segmentsTemplates[i].setAttribute('initialization','$RepresentationID$_0.m4v');
        }
    }

    function findAndKeepOnlyBestRepresentation(currentAdaptationSet, representations) {
        let bestBandwidth = findBestBandwith(representations);

        if (bestBandwidth !== null) {
            keepOnlyBestRepresentation(currentAdaptationSet, bestBandwidth);
        } else {
            throw new Error('Cannot find best Bandwith !');
        }
    }

    function keepOnlyBestRepresentation(currentAdaptationSet, bestBandwidth) {
        let i = 0;
        let representations = currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION);

        do {
            if (parseInt(representations[i].getAttribute(ATTRIBUTE_TYPE_BANDWITH)) !== bestBandwidth) {
                currentAdaptationSet.removeChild(representations[i]);
            } else if (representations[i + 1] !== undefined) {
                i++;
            } else {
                return;
            }
        } while (representations.length > 1);
    }

    function findAndKeepOnlySelectedBitrateRepresentation(currentAdaptationSet, representations, bitrate) {
        let i = 0;
        do {
            if (parseInt(representations[i].getAttribute(ATTRIBUTE_TYPE_BANDWITH)) !== bitrate) {
                currentAdaptationSet.removeChild(representations[i]);
            } else if (representations[i + 1] !== undefined) {
                i++;
            } else {
                return;
            }
        } while (representations.length > 1);
    }

    function findBestBandwith(representations) {
        let bestBandwidth = null;

        for (let i = 0; i < representations.length; i++) {
            if (representations[i].nodeType === 1) { //element
                //logger.warn('ID : ' + representations[i].getAttribute(ATTRIBUTE_TYPE_ID));
                let bandwidth = parseInt(representations[i].getAttribute(ATTRIBUTE_TYPE_BANDWITH));
                if (bestBandwidth < bandwidth) {
                    bestBandwidth = bandwidth;
                }
            }
        }
        return bestBandwidth;
    }

    //  UTILS

    function wait(delay) {
        return new Promise(function (resolve) {
            setTimeout(resolve, delay);
        });
    }

    function getBestRepresentationId(currentAdaptationSet) {
        let bestRepresentation = currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION)[0];
        console.log(bestRepresentation.getAttribute(ATTRIBUTE_TYPE_ID));
        return bestRepresentation.getAttribute(ATTRIBUTE_TYPE_ID);
    }

    function getFragmentId(url) {
        let idxFragId = url.lastIndexOf('/');
        //logger.warn('fragId : ' + url.substring(idxFragId + 1, url.length));
        return url.substring(idxFragId,url.length);
    }

    setup();

    instance = {
        parse: parse
    };

    return instance;
}
OfflineIndexDBManifestParser.__dashjs_factory_name = 'OfflineIndexDBManifestParser';
export default FactoryMaker.getClassFactory(OfflineIndexDBManifestParser);