# SchermoLive

File pronti da scaricare:

- [App Android](SchermoLive.apk) — APK di debug, firmato per installazioni di prova.
- [App iOS](SchermoLive.ipa) — IPA non firmato; va firmato prima dell’installazione.

Viewer iOS: https://schermolive-2-0.onrender.com/view
Viewer Android: https://schermolive-android.onrender.com/view

Da un browser desktop aggiornato su Windows o macOS, apri https://schermolive-android.onrender.com/share e premi **Avvia condivisione**. Seleziona lo schermo o la finestra nella richiesta del browser; per interrompere, usa il pulsante nella pagina o i controlli del browser. La pagina trasmette solo fotogrammi video, senza audio. Gli spettatori possono aprire il viewer Android.

La condivisione richiede un browser che supporti `getDisplayMedia` e una pagina servita tramite HTTPS. Per pubblicare il server Android su Render, imposta Root Directory su `server`, Build Command su `npm install` e Start Command su `npm start`; Render serve la pagina di condivisione allo stesso indirizzo del server con il percorso `/share`.
