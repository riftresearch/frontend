

if (typeof window !== 'undefined') {
  window.particlesJS = window.particlesJS || {
    load: function(containerId, configPath, callback) {
      console.log('Particles.js load called with:', containerId, configPath);
      if (callback) {
        callback();
      }
    }
  };
}

export default function initParticles() {
  console.log('Particles.js initialized');
}
