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
const localforage = require('localforage');

function IndexDBStore(cfg) {

    cfg = cfg || {};
    const context = this.context;
    let instance,
        logger,
        manifestStore,
        fragmentStore;

    manifestStore = localforage.createInstance({
        driver: localforage.INDEXEDDB,
        name: 'dash_offline_db',
        version: 1.0,
        storeName: 'manifest-v2'
    });

    fragmentStore = localforage.createInstance({
        driver: localforage.INDEXEDDB,
        name: 'dash_offline_db',
        version: 1.0,
        storeName: 'fragment-v2'
    });

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
    }

    function readFragmentByKey(key) {
        return fragmentStore.getItem(key).then(function (value) {
            return Promise.resolve(value);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    function readManifestByKey(key) {
        return manifestStore.getItem(key).then(function (value) {
            return Promise.resolve(value);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    function storeManifest(manifest) {
        return manifestStore.length().then(function (nbKeys) {

            return manifestStore.setItem(nbKeys + 1, manifest, function (value) {
                return Promise.resolve(value);
            }).catch(function (err) {
                return Promise.reject(err);
            });
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    function storeFragment(fragmentId, fragmentData) {
        let key = fragmentId;
        let value = fragmentData;
        return fragmentStore.setItem(key, value, function () {
            return Promise.resolve(value);
        }).catch(function (err) {
            return Promise.reject(err);
        });

    }

    function dropAll() {
        localforage.clear().then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    /*
    function saveGenericManifest() {
        return manifestStore.length().then(function (nbKeys) {
            let value = "&lt;MPD mediaPresentationDuration=&quot;PT634.566S&quot; minBufferTime=&quot;PT2.00S&quot; profiles=&quot;urn:hbbtv:dash:profile:isoff-live:2012,urn:mpeg:dash:profile:isoff-live:2011&quot; type=&quot;static&quot; xmlns=&quot;urn:mpeg:dash:schema:mpd:2011&quot; xmlns:xsi=&quot;http://www.w3.org/2001/XMLSchema-instance&quot; xsi:schemaLocation=&quot;urn:mpeg:DASH:schema:MPD:2011 DASH-MPD.xsd&quot;&gt;&lt;BaseURL&gt;offline_indexdb://akamai/bbb_30fps/&lt;/BaseURL&gt;&lt;Period&gt;&lt;AdaptationSet mimeType=&quot;video/mp4&quot; contentType=&quot;video&quot; subsegmentAlignment=&quot;true&quot; subsegmentStartsWithSAP=&quot;1&quot; par=&quot;16:9&quot;&gt;&lt;SegmentTemplate duration=&quot;120&quot; timescale=&quot;30&quot; media=&quot;$RepresentationID$/$RepresentationID$_$Number$.m4v&quot; startNumber=&quot;1&quot; initialization=&quot;$RepresentationID$/$RepresentationID$_0.m4v&quot;/&gt;&lt;Representation id=&quot;bbb_30fps_3840x2160_12000k&quot; codecs=&quot;avc1.640033&quot; bandwidth=&quot;14931538&quot; width=&quot;3840&quot; height=&quot;2160&quot; frameRate=&quot;30&quot; sar=&quot;1:1&quot; scanType=&quot;progressive&quot;/&gt;&lt;/AdaptationSet&gt;&lt;AdaptationSet mimeType=&quot;audio/mp4&quot; contentType=&quot;audio&quot; subsegmentAlignment=&quot;true&quot; subsegmentStartsWithSAP=&quot;1&quot;&gt;&lt;Accessibility schemeIdUri=&quot;urn:tva:metadata:cs:AudioPurposeCS:2007&quot; value=&quot;6&quot;/&gt;&lt;Role schemeIdUri=&quot;urn:mpeg:dash:role:2011&quot; value=&quot;main&quot;/&gt;&lt;SegmentTemplate duration=&quot;192512&quot; timescale=&quot;48000&quot; media=&quot;$RepresentationID$/$RepresentationID$_$Number$.m4a&quot; startNumber=&quot;1&quot; initialization=&quot;$RepresentationID$/$RepresentationID$_0.m4a&quot;/&gt;&lt;Representation id=&quot;bbb_a64k&quot; codecs=&quot;mp4a.40.5&quot; bandwidth=&quot;67071&quot; audioSamplingRate=&quot;48000&quot;&gt;&lt;AudioChannelConfiguration schemeIdUri=&quot;urn:mpeg:dash:23003:3:audio_channel_configuration:2011&quot; value=&quot;2&quot;/&gt;&lt;/Representation&gt;&lt;/AdaptationSet&gt;&lt;/Period&gt;&lt;/MPD&gt;";
            return manifestStore.setItem(nbKeys + 1, value, function () {
                return Promise.resolve();
            }).catch(function (err) {
                return Promise.reject(err);
            });
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }
    */

    instance = {
        dropAll: dropAll,
        readFragmentByKey: readFragmentByKey,
        readManifestByKey: readManifestByKey,
        storeFragment: storeFragment,
        //saveGenericManifest: saveGenericManifest,
        storeManifest: storeManifest
    };
    setup();
    return instance;
}

IndexDBStore.__dashjs_factory_name = 'IndexDBStore';
const factory = FactoryMaker.getClassFactory(IndexDBStore);
export default factory;