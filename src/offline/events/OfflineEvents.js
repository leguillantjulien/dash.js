import EventsBase from './../../core/events/EventsBase';
/**
 * These are offline events that should not be needed at the player level.
 * @class
 * @ignore
 */
class OfflineEvents extends EventsBase {
    constructor () {
        super();
        this.DOWNLOADING_STARTED = 'downloadingStarted';
        this.DOWNLOADING_PAUSED = 'downloadingPaused';
        this.DOWNLOADING_STOPPED = 'downloadingStopped';
        this.DOWNLOADING_FINISHED = 'downloadingFinished';
    }
}

let offlineEvents = new OfflineEvents();
export default offlineEvents;
