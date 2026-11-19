Schermo Live

Condividi lo schermo del tuo iPhone in diretta su una pagina web. Apri il link su un computer o su un altro telefono e vedi subito ciò che succede sull'iPhone, anche mentre usi altre app.

Cosa ti serve
Un iPhone con iOS 16 o successivo
Una connessione a internet
Un browser su un altro dispositivo (computer, tablet o telefono) per guardare lo schermo
Installazione
Installa TestFlight dall'App Store, se non l'hai già.
Apri il link di invito che ti abbiamo mandato: LINK_TESTFLIGHT
Tocca Installa (o Accetta, poi Installa).
Apri Schermo Live dalla schermata Home.
Come si usa
Sul dispositivo da cui vuoi guardare, apri la pagina di visione: scrivi il link che vedi nell'app oppure inquadra il QR code con la fotocamera.
Sull'iPhone apri Schermo Live e premi Avvia condivisione.
Scegli «Schermo Live» nell'elenco e tocca Avvia trasmissione.
Dopo il conto alla rovescia di 3 secondi puoi uscire dall'app. Lo schermo compare nella pagina web.
Per fermare, tocca la barra rossa (o la pillola rossa) in alto sull'iPhone e scegli Interrompi.
Domande frequenti

Si sente l'audio? No, viene trasmesso solo il video.

Perché l'immagine non è in alta definizione? La qualità è volutamente ridotta per mantenere la trasmissione fluida anche con una connessione normale.

La pagina resta nera con «In attesa della trasmissione…» Controlla di aver avviato la trasmissione sull'iPhone e che entrambi i dispositivi siano online. Se la pagina era aperta da molto tempo, ricaricala.

Chi può vedere il mio schermo? Chiunque abbia il link della pagina di visione. Non condividerlo con persone di cui non ti fidi e non trasmettere schermate con dati sensibili (password, messaggi privati).

Il programma di installazione scade? Le versioni distribuite con TestFlight restano valide 90 giorni. Prima della scadenza ti arriverà una notifica per aggiornare.

Per chi sviluppa

Il repository contiene tre parti:

Cartella	Contenuto
SchermoLive/	App iOS in SwiftUI (pulsante di avvio, link e QR code)
SchermoLiveBroadcast/	Estensione di trasmissione che invia i fotogrammi al server
server/	Server Node.js: pagina /view e inoltro dei fotogrammi
Come funziona
iPhone (estensione) → WebSocket /ingest → server Node.js → WebSocket /watch → browser su /view

L'estensione riceve i fotogrammi da ReplayKit, li riduce a 540 px di larghezza, li converte in JPEG e li invia al server circa 10 volte al secondo. Il server li inoltra subito ai visualizzatori collegati, senza salvarli.

Configurazione
In SchermoLive/Config.swift imposta viewerURL e ingestURL con l'indirizzo del tuo server.
In project.yml sostituisci com.example con il tuo identificatore (l'estensione deve restare <app>.broadcast).
Pubblica la cartella server/ (per esempio su Render: Root Directory server, Build npm install, Start npm start).
Compilare l'.ipa

Il workflow Build IPA (scheda Actions, «Run workflow») compila l'app su un runner macOS e produce SchermoLive.ipa non firmato. Per distribuirlo ai clienti va firmato con un account Apple Developer e caricato su TestFlight.

Server in locale
bash
cd server
npm install
npm start

Poi apri http://localhost:3000/view.
