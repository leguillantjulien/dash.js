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
const Entities = require('html-entities').XmlEntities;

const ELEMENT_TYPE_PERIOD = 'Period';
const ELEMENT_TYPE_ADAPTATIONSET = 'AdaptationSet';
const ELEMENT_TYPE_REPRESENTATION = 'Representation';

function OfflineIndexDBManifestParser() {
    const context = this.context;

    let instance,
        DOM,
        logger;


    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
    }

    function parse(XMLDoc) {

        DOM = new DOMParser().parseFromString(XMLDoc, 'application/xml');
        let mpd = DOM.getElementsByTagName('MPD') ? DOM.getElementsByTagName('MPD') : null;

        for (let i = 0; i < mpd.length; i++) {
            if (mpd[i] !== null) {
                console.log(mpd[i]);
                browsePeriods(mpd[i]);
            }
        }
        logger.warn('finished ==>' + new XMLSerializer().serializeToString(DOM));

        return new Entities().encode(new XMLSerializer().serializeToString(DOM));
    }

    function browsePeriods(currentMPD) {
        let periods = currentMPD.getElementsByTagName(ELEMENT_TYPE_PERIOD);

        console.log('periods.length : ' + periods.length);
        for (let j = 0; j < periods.length; j++) {
            browseAdaptationsSet(periods[j]);
        }
    }

    function browseAdaptationsSet(currentPeriod) {
        let adaptationsSet = currentPeriod.getElementsByTagName(ELEMENT_TYPE_ADAPTATIONSET);
        console.log('Nb d adaptationsSet : ' + adaptationsSet.length);
        for (let i = 0; i < adaptationsSet.length; i++) {
            logger.warn(i + ' ème adaptation set');
            let currentAdaptationSet;
            currentAdaptationSet = adaptationsSet[i];
            browseRepresentations(currentAdaptationSet);
        }
    }

    function browseRepresentations(currentAdaptationSet) {
        let bestBandwidth,
            representations;

        representations = currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION);
        bestBandwidth = findBestBandwith(representations);

        if (bestBandwidth !== null) {
            logger.info('bestBandwidth -->' + bestBandwidth);
            keepOnlyBestRepresentation(currentAdaptationSet, bestBandwidth);
        } else {
            throw new Error('Cannot find best Bandwith ! ');
        }
    }

    function findBestBandwith(representations) {
        let bestBandwidth = null;

        for (let i = 0; i < representations.length; i++) {
            if (representations[i].nodeType === 1) { //element
                logger.warn('ID : ' + representations[i].getAttribute('id'));
                let bandwidth = parseInt(representations[i].getAttribute('bandwidth'));
                if (bestBandwidth < bandwidth) {
                    bestBandwidth = bandwidth;
                }
            }
        }
        return bestBandwidth;
    }

    function keepOnlyBestRepresentation(currentAdaptationSet, bestBandwidth) {
        let i = 0;
        let representations = currentAdaptationSet.getElementsByTagName(ELEMENT_TYPE_REPRESENTATION);
        do {
            if (parseInt(representations[i].getAttribute('bandwidth')) !== bestBandwidth) {
                logger.warn('remove : ' + representations[i].getAttribute('id'));
                logger.warn('i : ' + i);
                currentAdaptationSet.removeChild(representations[i]);
            } else if (representations[i + 1] !== undefined) {
                console.log('next siblin');
                i++;
            } else {
                return;
            }
            for (let k = 0; k < representations.length; k++) {
                logger.warn('ID RESTANTS => ' + representations[k].getAttribute('id'));
            }
            console.log('representations.length :' + representations.length);
        } while (representations.length > 1);

    }

    setup();

    instance = {
        parse: parse
    };

    return instance;
}
OfflineIndexDBManifestParser.__dashjs_factory_name = 'OfflineIndexDBManifestParser';
export default FactoryMaker.getClassFactory(OfflineIndexDBManifestParser);