export function createAudioController({ setLed, flashLedTimes, loadTimeout = 8000 } = {}) {
  const audioCache = new Map();
  const audioActive = new Set();
  const audioLoading = new Set();
  const audioLoadTimers = new Map();

  const updateAudioLed = () => {
    if (typeof setLed === 'function') {
      setLed(0, audioActive.size > 0);
    }
  };

  const updateLoadingLed = () => {
    if (typeof setLed === 'function') {
      setLed(2, audioLoading.size > 0);
    }
  };

  const clearAudioLoadTimer = (url) => {
    const timeoutId = audioLoadTimers.get(url);
    if (timeoutId) {
      clearTimeout(timeoutId);
      audioLoadTimers.delete(url);
    }
  };

  const clearAudioLoading = (url) => {
    if (!url) return;
    audioLoading.delete(url);
    updateLoadingLed();
    clearAudioLoadTimer(url);
  };

  const handleAudioError = (url) => {
    const audio = audioCache.get(url);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    clearAudioLoading(url);
    audioActive.delete(url);
    updateAudioLed();
    if (typeof flashLedTimes === 'function') {
      flashLedTimes(1, 3, 220);
    }
  };

  const markAudioLoading = (url, audio) => {
    if (!url || !audio) return;
    audioLoading.add(url);
    updateLoadingLed();
    clearAudioLoadTimer(url);
    const timer = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      handleAudioError(url);
    }, loadTimeout);
    audioLoadTimers.set(url, timer);
  };

  const getAudio = (url) => {
    if (!url) return null;
    const existing = audioCache.get(url);
    if (existing) return existing;
    const audio = new Audio(url);
    audio.addEventListener('playing', () => {
      audioActive.add(url);
      clearAudioLoading(url);
      updateAudioLed();
    });
    audio.addEventListener('ended', () => {
      audioActive.delete(url);
      updateAudioLed();
    });
    audio.addEventListener('pause', () => {
      if (audio.currentTime >= audio.duration) return;
      audioActive.delete(url);
      updateAudioLed();
    });
    audio.addEventListener('loadeddata', () => clearAudioLoading(url));
    audio.addEventListener('canplaythrough', () => clearAudioLoading(url));
    audio.addEventListener('loadedmetadata', () => clearAudioLoading(url));
    audio.addEventListener('error', () => {
      handleAudioError(url);
    });
    audioCache.set(url, audio);
    return audio;
  };

  const stopAll = (exceptUrl = null) => {
    audioCache.forEach((audio, url) => {
      if (url === exceptUrl) return;
      audio.pause();
      audio.currentTime = 0;
      audioActive.delete(url);
      clearAudioLoading(url);
    });
    updateAudioLed();
  };

  const preload = (url) => {
    const audio = getAudio(url);
    if (!audio) return null;
    audio.preload = 'auto';
    if (audio.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      markAudioLoading(url, audio);
    } else {
      clearAudioLoading(url);
    }
    audio.load();
    return audio;
  };

  const play = (url) => {
    const audio = getAudio(url);
    if (!audio) return null;
    stopAll(url);
    if (audio.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      markAudioLoading(url, audio);
    } else {
      clearAudioLoading(url);
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return audio;
  };

  const destroy = () => {
    audioCache.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioActive.clear();
    audioLoading.clear();
    audioLoadTimers.forEach((timer) => clearTimeout(timer));
    audioLoadTimers.clear();
    updateAudioLed();
    updateLoadingLed();
  };

  return {
    get: getAudio,
    preload,
    play,
    stopAll,
    destroy,
    audioCache,
    audioActive,
    audioLoading,
  };
}
