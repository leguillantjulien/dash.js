import EventsBase from './../core/events/EventsBase';

class OfflineEvents extends EventsBase {
    constructor () {
        super();
        this.OFFLINE_STREAM_PROCESSOR_COMPLETED = 'offlineStreamProcessorCompleted';
        this.DOWNLOADING_STARTED = 'downloadingStarted';
        this.DOWNLOADING_PAUSED = 'downloadingPaused';
        this.DOWNLOADING_STOPPED = 'downloadingStopped';
        this.DOWNLOADING_FINISHED = 'downloadingFinished';
    }
}

let offlineEvents = new OfflineEvents();
export default offlineEvents;
