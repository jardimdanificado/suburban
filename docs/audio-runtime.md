# Áudio do Suburban

O runtime fica em `js/suburban_audio.js` e usa Web Audio API. O contexto só é criado após o primeiro gesto do jogador, por causa das regras de autoplay do navegador.

## Banco de eventos

Carregue um manifesto depois de desbloquear o áudio:

```js
await suburbanAudio.loadBank({
  events: {
    "city.traffic": { src: "audio/traffic.ogg", bus: "ambience", loop: true, gain: 0.35 },
    "building.place": { src: "audio/place.wav", bus: "sfx", gain: 0.7 },
  },
});
```

`src` é resolvido em relação à página atual. Os formatos dependem do suporte de `decodeAudioData` do navegador. Eventos sem `src` podem ser registrados como tons sintetizados com `waveform`, `frequency`, `endFrequency`, `duration` e `gain`.

## Reprodução

```js
const sound = suburbanAudio.play("city.traffic", { x: 20, y: 2.5, z: 12, spatial: true, maxDistance: 48 });
sound?.stop(0.2); // fade de parada em segundos
suburbanAudio.setListener3D(cameraX, cameraHeight, cameraZ, {
  forwardX, forwardY, forwardZ,
  upX, upY, upZ,
});
suburbanAudio.setParameter("pitch", 1.1);
suburbanAudio.setBusVolume("ambience", 0.5);
```

No espaço 3D, `x`, `y` e `z` seguem os eixos da cena Three.js: X e Z são o mapa, Y é a altura. A câmera ativa atualiza a posição e orientação do listener automaticamente. Fontes 3D usam HRTF, atenuação inversa por distância e os parâmetros `refDistance`, `maxDistance` e `rolloffFactor`. O formato 2D legado continua disponível com `setListener(x, y)` e fontes que passam apenas `x` e `y`.

Os buses disponíveis são `master`, `music`, `ambience`, `sfx` e `ui`.
