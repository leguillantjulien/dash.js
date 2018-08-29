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
import IndexDBStore from './../storage/IndexDBStore';

/**
 * @class
 * @description Offline Storage Controller
 */
function OfflineStoreController() {

    const context = this.context;

    let instance,
        errHandler,
        indexDBStore;

    function setup() {
        indexDBStore = IndexDBStore(context).getInstance();
    }

    function setConfig(config) {
        if (config.errHandler) {
            errHandler = config.errHandler;
        }
    }
    
    function setFragmentStore(storeName) {
        indexDBStore.setFragmentStore(storeName);
    }

    function storeFragment(fragmentId, fragmentData) {
        indexDBStore.storeFragment(fragmentId, fragmentData).catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    function storeOfflineManifest(manifest) {
        return indexDBStore.storeManifest(manifest).catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    function getCurrentHigherManifestId() {
        return indexDBStore.getCurrentHigherManifestId().catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    function getAllManifests() {
        return indexDBStore.getAllManifests().catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    function deleteRecordById(manifestId) {
        return indexDBStore.deleteRecordById(manifestId).catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    function isFragmentStoreInitialized() {
        return indexDBStore.isFragmentStoreInitialized().catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    function setDownloadingStatus(manifestId, status) {
        indexDBStore.setDownloadingStatus(manifestId, status).catch(function (err) {
            errHandler.indexedDBError(err);
        });
    }

    instance = {
        setConfig: setConfig,
        isFragmentStoreInitialized: isFragmentStoreInitialized,
        storeFragment: storeFragment,
        storeOfflineManifest: storeOfflineManifest,
        setFragmentStore: setFragmentStore,
        getCurrentHigherManifestId: getCurrentHigherManifestId,
        getAllManifests: getAllManifests,
        deleteRecordById: deleteRecordById,
        setDownloadingStatus: setDownloadingStatus
    };

    setup();

    return instance;
}

OfflineStoreController.__dashjs_factory_name = 'OfflineStoreController';
export default FactoryMaker.getClassFactory(OfflineStoreController);
