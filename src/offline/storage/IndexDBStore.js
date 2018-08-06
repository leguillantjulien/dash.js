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
const entities = require('html-entities').XmlEntities;

function IndexDBStore() {

    const context = this.context;
    let instance,
        logger,
        manifestStore,
        fragmentStore;

    manifestStore = localforage.createInstance({
        driver: localforage.INDEXEDDB,
        name: 'dash_offline_db',
        version: 1.0,
        storeName: 'manifest'
    });

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
    }

    function setFragmentStore(storeName) {
        console.log('setStore  ' + storeName);
        fragmentStore = localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: 'dash_offline_db',
            version: 1.0,
            storeName: storeName
        });
        return;
    }

    function getFragmentByKey(key) {
        return fragmentStore.getItem(key).then(function (value) {
            //console.log('getFragmentByKey => ' + value);
            return Promise.resolve(value);
        }).catch(function (err) {
            return Promise.reject(err);
        });

    }

    function getManifestByKey(key) {
        return manifestStore.getItem('manifest').then(function (manifestsArray) {
            let manifests,
                item,
                response;

            manifests = manifestsArray.manifests;
            if (manifests.length) {
                item = manifests[key - 1];
                if (item !== null) {
                    response = {
                        'manifest': entities.decode(item.manifest.manifest),
                        'url': item.manifest.url,
                        'originalURL': item.manifest.originalURL,
                        'fragmentStore': item.manifest.fragmentStore
                    };

                    return Promise.resolve(response);
                } else {
                    return Promise.reject('Cannot found manifest with this key !');
                }
            } else {
                return Promise.reject('Any manifests stored in DB !');
            }
        }).catch(function (err) {
            console.log('err => ' + err);
            return Promise.reject(err);
        });
    }

    function getAllManifests() {
        return manifestStore.getItem('manifest').then(function (array) {
            return Promise.resolve(array);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    function countManifest() {
        return manifestStore.getItem('manifest').then(function (manifestsArray) {
            if (manifestsArray && manifestsArray.manifests) {
                return Promise.resolve(manifestsArray.manifests.length);
            } else {
                return Promise.resolve(0);
            }
        }).catch(function (err) {
            return Promise.resolve(err);
        });
    }

    function storeManifest(manifest) {
        manifestStore.getItem('manifest').then(function (results) {
            let manifestsArray = results ? results : {'manifests': [] };
            manifestsArray.manifests.push({['manifest']: manifest} );
            manifestStore.setItem('manifest',manifestsArray);
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
        return localforage.clear().then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }


    instance = {
        dropAll: dropAll,
        getFragmentByKey: getFragmentByKey,
        getManifestByKey: getManifestByKey,
        storeFragment: storeFragment,
        storeManifest: storeManifest,
        setFragmentStore: setFragmentStore,
        countManifest: countManifest,
        getAllManifests: getAllManifests
    };
    setup();
    return instance;
}

IndexDBStore.__dashjs_factory_name = 'IndexDBStore';
export default FactoryMaker.getSingletonFactory(IndexDBStore);