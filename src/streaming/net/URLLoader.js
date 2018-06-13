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
import HTTPLoader from './HTTPLoader';
import EventBus from './../../core/EventBus';
import NetworkLoader from './NetworkLoader';
import Events from './../../core/events/Events';
import FactoryMaker from '../../core/FactoryMaker';

const HTTP_PREFIX = 'http://';
const HTTPS_PREFIX = 'https://';
const OFFLINE_PREFIX = 'offline:manifest/idb/';
const FRAGMENT_LOADER_ERROR_LOADING_FAILURE = 1;
const FRAGMENT_LOADER_ERROR_NULL_REQUEST = 2;
const FRAGMENT_LOADER_MESSAGE_NULL_REQUEST = 'request is null';
/**
 * @implements NetworkLoader
 */
function URLLoader(cfg) {

    cfg = cfg || {};
    const context = this.context;
    const eventBus = EventBus(context).getInstance();

    let instance,
        httpLoader,
        scheme;

    httpLoader = HTTPLoader(context).create({
        errHandler: cfg.errHandler,
        metricsModel: cfg.metricsModel,
        mediaPlayerModel: cfg.mediaPlayerModel,
        requestModifier: cfg.requestModifier,
        useFetch: cfg.mediaPlayerModel.getLowLatencyEnabled()
    });

    function registerNetworkLoader(request) {
        const report = function (data, error) {
            eventBus.trigger(Events.LOADING_ONLINE_COMPLETED, {
                request: request,
                response: data || null,
                error: error || null,
                sender: instance
            });
        };

        scheme = request.url;
        if (scheme.includes(HTTP_PREFIX) || scheme.includes(HTTPS_PREFIX)) {
            httpLoader.load({
                request: request,
                progress: function (data) {
                    eventBus.trigger(Events.LOADING_PROGRESS, {
                        request: request
                    });
                    if (data) {
                        eventBus.trigger(Events.LOADING_DATA_PROGRESS, {
                            request: request,
                            response: data || null,
                            error: null,
                            sender: instance
                        });
                    }
                },
                success: function (data) {
                    report(data);
                },
                error: function (request, statusText, errorText) {
                    report(
                        undefined,
                        new DashJSError(
                            FRAGMENT_LOADER_ERROR_LOADING_FAILURE,
                            errorText,
                            statusText
                        )
                    );
                },
                abort: function (request) {
                    if (request) {
                        eventBus.trigger(Events.LOADING_ABANDONED, {request: request, mediaType: request.mediaType, sender: instance});
                    }
                }
            });
        } else if (scheme.includes(OFFLINE_PREFIX)) {
            console.log('Offline reading ! IndexDBOfflineLoader');
            //
            //LOADING_OFFLINE_COMPLETED
            //IndexDBOfflineLoader
            //offline:manifest/idb/v3/2
        }
    }

    function unregisterNetworkLoader(scheme) {
        console.log('unregisterNetworkLoader called');
    }

    instance = {
        registerNetworkLoader: registerNetworkLoader,
        unregisterNetworkLoader: unregisterNetworkLoader,
    };

    return instance;

}
URLLoader.__dashjs_factory_name = 'URLLoader';

const factory = FactoryMaker.getClassFactory(URLLoader);
export default factory;

