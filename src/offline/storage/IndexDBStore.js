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
        isFragmentStoreInit,
        fragmentStore;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        fragmentStore = null;
        isFragmentStoreInit = false;

        localforage.config({
            driver: localforage.INDEXEDDB,
            name: 'dash_offline_db'
        });

        manifestStore = localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: 'dash_offline_db',
            version: 1.0,
            storeName: 'manifest'
        });
    }

    /////////////////////////////////////////
    //
    // GET/SET Methods
    //
    ////////////////////////////////////////

    function setFragmentStore(storeName) {
        console.log('setStore  ' + storeName);
        fragmentStore = localforage.createInstance({
            driver: localforage.INDEXEDDB,
            name: 'dash_offline_db',
            version: 1.0,
            storeName: storeName
        });
        isFragmentStoreInit = true;
    }

    function isFragmentStoreInitialized() {
        return isFragmentStoreInit;
    }

    function dropFragmentStore(storeName) {
        localforage.dropInstance({
            driver: localforage.INDEXEDDB,
            name: 'dash_offline_db',
            version: 1.0,
            storeName: storeName
        }).then(function () {
            fragmentStore = null;
            isFragmentStoreInit = false;
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

            if (manifestsArray && manifestsArray.manifests) {
                manifests = manifestsArray.manifests;

                for (let i = 0; i < manifests.length; i++) {
                    if (manifests[i].manifest.manifestId === parseInt(key)) {
                        item = manifests[i];
                    }
                }

                if (item !== null) {
                    response = {
                        'manifest': entities.decode(item.manifest.manifest),
                        'url': item.manifest.url,
                        'originalURL': item.manifest.originalURL,
                        'fragmentStore': item.manifest.fragmentStore
                    };

                    return Promise.resolve(response);
                } else {
                    return Promise.reject('Cannot found manifest with this manifestId !');
                }
            } else {
                return Promise.reject('Any manifests stored in DB !');
            }
        }).catch(function (err) {
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
            let higherManifestId = 0;
            if (manifestsArray && manifestsArray.manifests) {
                let manifests = manifestsArray.manifests;
                for (let i = 0; i < manifests.length; i++) {
                    if (manifests[i].manifest.manifestId > higherManifestId) {
                        higherManifestId = manifests[i].manifest.manifestId;
                    }
                }
                return Promise.resolve(higherManifestId);
            } else {
                return Promise.resolve(higherManifestId);
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
        if (isFragmentStoreInitialized()) {
            return fragmentStore.setItem(fragmentId, fragmentData, function () {
                return Promise.resolve();
            }).catch(function (err) {
                return Promise.reject(err);
            });
        } else return Promise.reject('FragmentStore Not Init');
    }

    /////////////////////////////////////////
    //
    // DROP Methods
    //
    ////////////////////////////////////////

    function dropAll() {
        return localforage.clear().then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    function deleteManifestById(manifestId) {
        return manifestStore.getItem('manifest').then(function (manifestsArray) {
            if (manifestsArray && manifestsArray.manifests) {
                return deleteManifestStore('manifest_' + manifestId).then(function () {
                    let manifests = manifestsArray.manifests;

                    for (let i = 0; i < manifests.length; i++) {
                        if (manifests[i].manifest.manifestId === parseInt(manifestId)) {
                            manifests.splice(i, 1);
                        }
                    }
                    return manifestStore.setItem('manifest', manifestsArray).then(function () {
                        return Promise.resolve('This stream has been successfull removed !');
                    }).catch(function () {
                        return Promise.reject('An error occured when trying to delete this manifest');
                    });
                });
            } else {
                return Promise.resolve('Nothing to delete !');
            }
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    function deleteManifestStore(storeName) {
        localforage.createInstance({
            name: 'dash_offline_db',
            storeName: storeName
        });
        return localforage.dropInstance({
            name: 'dash_offline_db',
            storeName: storeName
        }).then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            console.log(err);
            return Promise.reject(err);
        });

    }


    setup();

    instance = {
        dropAll: dropAll,
        getFragmentByKey: getFragmentByKey,
        getManifestByKey: getManifestByKey,
        storeFragment: storeFragment,
        storeManifest: storeManifest,
        setFragmentStore: setFragmentStore,
        countManifest: countManifest,
        getAllManifests: getAllManifests,
        dropFragmentStore: dropFragmentStore,
        isFragmentStoreInitialized: isFragmentStoreInitialized,
        deleteManifestById: deleteManifestById
    };

    return instance;
}

IndexDBStore.__dashjs_factory_name = 'IndexDBStore';
export default FactoryMaker.getSingletonFactory(IndexDBStore);