import { useEffect } from 'react';
import { useDialKit } from 'dialkit';
import { setters, defaults } from './carousel.js';

export function CarouselControls() {
    const p = useDialKit('Carousel', {
        geometry: {
            cameraZ: [defaults.cameraZ, 1, 80, 0.5],
            height: [defaults.height, 1, 10, 0.1],
            padding: [defaults.padding, 0, 10, 0.05],
            cornerRadius: [defaults.cornerRadius, 0, 0.5, 0.01]
        },
        timing: {
            autoDur: [defaults.autoDur, 1, 10, 0.1],
            arrowPad: [defaults.arrowPad, 10, 400, 1],
            pillBottom: [defaults.pillBottom, 10, 300, 1]
        },
        audio: {
            audioHigh: [defaults.audioHigh, 50, 1000, 10],
            audioLow: [defaults.audioLow, 10, 500, 10],
            audioDur: [defaults.audioDur, 10, 200, 1]
        }
    });

    useEffect(() => { setters.cameraZ(p.geometry.cameraZ); }, [p.geometry.cameraZ]);
    useEffect(() => { setters.height(p.geometry.height); }, [p.geometry.height]);
    useEffect(() => { setters.padding(p.geometry.padding); }, [p.geometry.padding]);
    useEffect(() => { setters.cornerRadius(p.geometry.cornerRadius); }, [p.geometry.cornerRadius]);

    useEffect(() => { setters.autoDur(p.timing.autoDur); }, [p.timing.autoDur]);
    useEffect(() => { setters.arrowPad(p.timing.arrowPad); }, [p.timing.arrowPad]);
    useEffect(() => { setters.pillBottom(p.timing.pillBottom); }, [p.timing.pillBottom]);

    useEffect(() => { setters.audioHigh(p.audio.audioHigh); }, [p.audio.audioHigh]);
    useEffect(() => { setters.audioLow(p.audio.audioLow); }, [p.audio.audioLow]);
    useEffect(() => { setters.audioDur(p.audio.audioDur); }, [p.audio.audioDur]);

    return null;
}
