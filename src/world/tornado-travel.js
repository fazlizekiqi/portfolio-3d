// Re-export shim — preserves the original import path for main.js, whiteworld.js, gui.js.
// Implementation lives in world/tornado/.
export {
  tornadoParams, tornadoCamParams,
  setTornadoCartoon,
  isTornadoActive, isTornadoCameraActive,
  focusSpawnAndTravel, spawnCloud, travelTo, disposeCloud,
  tickTornado,
} from './tornado/tornado-lifecycle.js';
