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
const OFFLINE_BASE_URL = 'offline_indexdb://';

/**
 * @module OfflineIndexDBManifestParser
 * @description  Parse online manifest to offline manifest
 * @param {Object} config - dependances
*/
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

    /**
     * Parse le manifest original afin qu'il soit compatible avec la lecture hors ligne
     * @param {string} XMLDoc - manifest téléchargé
     * @returns {string} XML encodé
     * @memberof module:OfflineIndexDBManifestParser
     * @instance
    */
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

    /**
     * Encode le manifest nouvellement parsé
     * @param {string} DOM
     * @memberof module:OfflineIndexDBManifestParser
     * @returns {string} XML encodé
     * @instance
    */
    function encodeManifest(DOM) {
        logger.info('encodedManifest ' + new XMLSerializer().serializeToString(DOM));
        return new Entities().encode(new XMLSerializer().serializeToString(DOM));
    }

    /**
     * Parcours le contenu du mpd afin de modifier la baseURL pointant vers une URL en ligne vers le stockage local
     * @param {XML} currentMPD
     * @memberof module:OfflineIndexDBManifestParser
     * @instance
    */
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

    /**
     * Parcours le contenu de toutes les périodes du mpd
     * @param {XML} currentMPD
     * @memberof module:OfflineIndexDBManifestParser
     * @instance
    */
    function browsePeriods(currentMPD) {
        let periods = currentMPD.getElementsByTagName(ELEMENT_TYPE_PERIOD);
        for (let j = 0; j < periods.length; j++) {
            browseAdaptationsSet(periods[j]);
        }
    }

    /**
     * Parcours le contenu de l'AdaptionSet afin de modifier le segmentTemple, bitrates, représentations à supprimer..
     * @param {XML} currentPeriod
     * @memberof module:offline
     * @instance
    */
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

    /**
     * Retourne le content type contenu dans l'adaptationSet ou le mime type dans le cas échéant.
     * @param {XML} currentAdaptationSet
     * @memberof module:offline
     * @returns {string|null} type
     * @instance
    */
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

    /**
     * Retourne le bitrate pour le type du allMediaInfos s'il en existe un.
     * @param {string} type
     * @memberof module:offline
     * @returns {number|null} bitrate
     * @instance
    */
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

    /**
     * Retourne le contentType contenu dans l'attribut contentType de l'adaptationSet s'il en existe un.
     * @param {XML} currentAdaptationSet
     * @memberof module:offline
     * @returns {string|null} contentType
     * @instance
    */
    function findAdaptationSetContentType(currentAdaptationSet) {
        return currentAdaptationSet.getAttribute('contentType');
    }

    /**
     * Retourne le mimeType contenu dans l'attribut mimeTyp de l'adaptationSet s'il en existe un.
     * @param {XML} currentAdaptationSet
     * @memberof module:offline
     * @returns {string|null} mimeType
     * @instance
    */
    function findAdaptationSetMimeType(currentAdaptationSet) {
        return currentAdaptationSet.getAttribute('mimeType');
    }

    /**
     * Retourne le tableau de représentations contenu dans un adaptationSet
     * @param {XML} currentAdaptationSet
     * @memberof module:offline
     * @returns {XML} representations
     * @instance
    */
    function findRepresentations(currentAdaptationSet) {
        return currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION);
    }

    /**
     * Retourne le tableau de représentations contenu dans un adaptationSet
     * @param {XML} currentAdaptationSet
     * @memberof module:offline
     * @returns {XML} representations
     * @instance
    */
    function getSegmentTemplate(currentAdaptationSet) {
        return currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_SEGMENT_TEMPLATE);
    }

    /**
     * Modifie les attributs de tous les segmentsTemples pour qu'ils possèdent les URLs compatibles avec la lecture hors ligne
     * @param {Array} segmentsTemplates
     * @memberof module:offline
     * @instance
    */
    function editSegmentTemplateAttributes(segmentsTemplates) {
        for (let i = 0; i < segmentsTemplates.length; i++) {
            let media = segmentsTemplates[i].getAttribute('media');
            media = '$RepresentationID$_$Number$' + media.substring(media.indexOf('.'), media.length); //id + extension
            segmentsTemplates[i].setAttribute('startNumber', '1');
            segmentsTemplates[i].setAttribute('media', media);
            segmentsTemplates[i].setAttribute('initialization','$RepresentationID$_0.m4v');
        }
    }

    /**
     * Trouve et garde uniquement la représentation possèdant la meilleur bande passante
     * @param {XML} currentAdaptationSet
     * @param {XML} representations
     * @memberof module:offline
     * @instance
    */
    function findAndKeepOnlyBestRepresentation(currentAdaptationSet, representations) {
        let bestBandwidth = findBestBandwith(representations);

        if (bestBandwidth !== null) {
            keepOnlyBestRepresentation(currentAdaptationSet, representations, bestBandwidth);
        } else {
            throw new Error('Cannot find best Bandwith !');
        }
    }

    /**
     * Supprime toutes les représentations excepté celle possèdant la meilleur bande passante
     * => (uniquement dans le cas où les bitrates n'ont pas été renseignés / introuvables)
     * @param {XML} currentAdaptationSet
     * @param {XML} representations
     * @param {number} bestBandwidth
     * @memberof module:offline
     * @instance
    */
    function keepOnlyBestRepresentation(currentAdaptationSet, representations, bestBandwidth) {
        let i = 0;

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

    /**
     * Supprime toutes les représentations excepté celle possèdant le bitrate passé en paramètre
     * => (cas où les bitrates ont été renseignés)
     * @param {XML} currentAdaptationSet
     * @param {XML} representations
     * @param {number} bitrate
     * @memberof module:offline
     * @instance
    */
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

    /**
     * Parcours toutes les représentations afin de récupérer celle possèdant la meilleure bande passante
     * @param {XML} representations
     * @returns {number} bestBandwidth
     * @memberof module:offline
     * @instance
    */
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

    /**
     * Timeout afin de faire les opérations sur le manifest --> TODO à remplacer par une promesse chainée
     * @param {number} delay
     * @memberof module:offline
     * @instance
    */
    function wait(delay) {
        return new Promise(function (resolve) {
            setTimeout(resolve, delay);
        });
    }

    /**
     * Retourne l'id de la 1er representation de l'adaptationSet
     * @param {XMl} currentAdaptationSet
     * @memberof module:offline
     * @returns {string} id
     * @instance
    */
    function getBestRepresentationId(currentAdaptationSet) {
        let bestRepresentation = currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION)[0];
        console.log(bestRepresentation.getAttribute(ATTRIBUTE_TYPE_ID));
        return bestRepresentation.getAttribute(ATTRIBUTE_TYPE_ID);
    }

    /**
     * Retourne la deuxième partie de l'URL contenant l'id => xxxx://xxxx/fragmentId/
     * @param {string} url
     * @memberof module:offline
     * @returns {string} fragmentId
     * @instance
    */
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