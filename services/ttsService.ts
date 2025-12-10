export const playPronunciation = async (text: string): Promise<void> => {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn("Text-to-speech not supported in this browser.");
      resolve();
      return;
    }

    // Cancel any ongoing speech to prevent queuing
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Set language to US English. Browsers usually pick a high-quality voice (like Google US English) if available.
    utterance.lang = 'en-US'; 
    utterance.rate = 0.9; // Slightly slower for better clarity

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (e) => {
      console.error("TTS Error:", e);
      // Resolve anyway to ensure UI loading state is reset
      resolve();
    };

    synth.speak(utterance);
  });
};