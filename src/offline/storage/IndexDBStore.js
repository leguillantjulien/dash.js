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
const localforage = require('localforage');
const entities = require('html-entities').XmlEntities;

/**
 * @module  IndexDBStore
 * @description IndexedDB Access
 */
function IndexDBStore() {

    let instance,
        manifestStore,
        isFragmentStoreInit,
        fragmentStore;

    function setup() {
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

    /**
     * Créer une instance localforage indexedDB afin de stocker les fragments téléchargés.
     * @param {string} storeName
     * @memberof module:IndexDBStore
     * @instance
    */
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

    /**
     * Retourne un boolean permettant de connaitre l'état d'initialisation du fragmentStore.
     * @memberof module:IndexDBStore
     * @returns {boolean} isFragmentStoreInit
     * @instance
    */
    function isFragmentStoreInitialized() {
        return isFragmentStoreInit;
    }

    /**
     * MaJ le status du téléchargement de l'enregistrement
     * @memberof module:IndexDBStore
     * @param {number} manifestId
     * @param {string} newStatus
     * @returns {boolean} isFragmentStoreInit
     * @instance
    */
    function setDownloadingStatus(manifestId, newStatus) {
        return getManifestById(manifestId).then(function (item) {
            item.status = newStatus;
            return updateManifest(item);
        });
    }

    /**
     * Retourne un fragment à partir de sa clé (id)
     * @memberof module:IndexDBStore
     * @param {number} key
     * @returns {Promise} fragment
     * @instance
    */
    function getFragmentByKey(key) {
        return fragmentStore.getItem(key).then(function (value) {
            //console.log('getFragmentByKey => ' + value);
            return Promise.resolve(value);
        }).catch(function (err) {
            return Promise.reject(err);
        });

    }

    /**
     * Permet d'obtenir un manifest à partir de son id
     * @memberof module:IndexDBStore
     * @param {number} id
     * @returns {Promise} {Object[]} manifests
     * @instance
    */
    function getManifestById(id) {
        return getAllManifests().then(function (array) {
            if (array) {
                let item = null;
                for (let i = 0; i < array.manifests.length; i++) {
                    if (array.manifests[i].manifestId === parseInt(id)) {
                        item = array.manifests[i];
                    }
                }
                if (item !== null) {
                    item.manifest = entities.decode(item.manifest);
                    return Promise.resolve(item);
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

    /**
     * Retourne le tableau des manifests
     * @memberof module:IndexDBStore
     * @returns {Promise} {Object[]} manifests
     * @instance
    */
    function getAllManifests() {
        return manifestStore.getItem('manifest').then(function (array) {
            return Promise.resolve(array ? array : { 'manifests': [] });
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    /**
     * Retourne l'id du manifest le plus élevé
     * @memberof module:IndexDBStore
     * @returns {Promise} number
     * @instance
    */
    function getCurrentHigherManifestId() {
        return getAllManifests().then(function (array) {
            let higherManifestId = 0;
            if (array) {
                for (let i = 0; i < array.manifests.length; i++) {
                    if (array.manifests[i].manifestId > higherManifestId) {
                        higherManifestId = array.manifests[i].manifestId;
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

    /**
     * MaJ le manifest
     * @memberof module:IndexDBStore
     * @param {Object} manifest à jour
     * @returns {Promise} Object promise de l'action
     * @instance
    */
    function updateManifest(manifest) {
        return getAllManifests().then(function (array) {
            try {
                for (let i = 0; i < array.manifests.length; i++) {
                    if (array.manifests[i].manifestId === manifest.manifestId) {
                        array.manifests[i] = manifest;
                    }
                }
                return manifestStore.setItem('manifest',array);
            } catch (err) {
                throw new Error('Any results found !');
            }
        });
    }

    /**
     * Stock un manifest dans le tableau des manifests
     * @memberof module:IndexDBStore
     * @param {Object} manifest
     * @instance
    */
    function storeManifest(manifest) {
        manifestStore.getItem('manifest').then(function (results) {
            let array = results ? results : { 'manifests': [] };
            array.manifests.push(manifest);
            manifestStore.setItem('manifest',array);
        });
    }

    /**
     * Stock un fragment dans le store initialisé
     * @memberof module:IndexDBStore
     * @param {number} fragmentId
     * @param {Object} fragmentData
     * @returns {Promise} résultat de l'ajout
     * @instance
    */
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

    /**
     * Supprime le contenu de tous les fragmentStore et du manifestStore
     * @memberof module:IndexDBStore
     * @returns {Promise} résultat de la suppression
     * @instance
    */
    function dropAll() {
        return localforage.clear().then(function () {
            return Promise.resolve();
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }

    /**
     * Supprime le store courant contenant les fragments
     * @param {string} storeName
     * @memberof module:IndexDBStore
     * @instance
    */
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

    /**
     * Supprime l'enregistrement (fragmentStore + du tableau des manifests), à partir de son Id
     * @memberof module:IndexDBStore
     * @param {number} manifestId
     * @returns {Promise} résultat de la suppression
     * @instance
    */
    function deleteRecordById(manifestId) {
        return manifestStore.getItem('manifest').then(function (array) {
            if (array) {
                return deleteFragmentStore('manifest_' + manifestId).then(function () {
                    for (let i = 0; i < array.manifests.length; i++) {
                        if (array.manifests[i].manifestId === parseInt(manifestId)) {
                            array.manifests.splice(i, 1);
                        }
                    }
                    return manifestStore.setItem('manifest', array).then(function () {
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

    /**
     * Supprime le store contenant les fragments
     * @memberof module:IndexDBStore
     * @param {string} storeName
     * @returns {Promise} résultat de la suppression
     * @instance
    */
    function deleteFragmentStore(storeName) {
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
        getManifestById: getManifestById,
        storeFragment: storeFragment,
        storeManifest: storeManifest,
        updateManifest: updateManifest,
        setFragmentStore: setFragmentStore,
        setDownloadingStatus: setDownloadingStatus,
        getCurrentHigherManifestId: getCurrentHigherManifestId,
        getAllManifests: getAllManifests,
        dropFragmentStore: dropFragmentStore,
        isFragmentStoreInitialized: isFragmentStoreInitialized,
        deleteRecordById: deleteRecordById
    };

    return instance;
}

IndexDBStore.__dashjs_factory_name = 'IndexDBStore';
export default FactoryMaker.getSingletonFactory(IndexDBStore);