# README

## Over de applicatie

In deze README staat uitgelegd welke packages geïnstalleerd moeten worden, welke environment variables nodig zijn en hoe de applicatie gestart kan worden.

Cinematch is een website die gebruikers helpt bij het vinden van een passende film of tv-show. Wanneer een gebruiker iets wil kijken, kan diegene eerst een vragenlijst invullen. Op basis van de antwoorden wordt de gebruiker gematcht aan een film of tv-show die daarbij past. Vervolgens kan de gebruiker de details van deze film of tv-show bekijken en zien waar deze te streamen of te bekijken is.

---

## Benodigdheden

Voordat je de applicatie kunt gebruiken, moet het volgende op je computer geïnstalleerd zijn:

- [Node.js](https://nodejs.org/)
- npm
- MongoDB of een MongoDB Atlas connectie

---

## Installatie

Open een terminal in de hoofdmap van het project en voer het volgende commando uit:

```bash
npm install
```

## .env bestand toevoegen

Maak in de hoofdmap van het project een bestand aan met de naam:

```env
.env
```

Voeg daarna de volgende variabelen toe zonder waarden:

```env
PORT=
DB_USERNAME=
DB_PASSWORD=
DB_HOST=
DB_NAME=
APP_NAME=
BASE_URL=
API_KEY=
```

---

## Database

Voor deze applicatie is gebruikgemaakt van **MongoDB** als database.

---

## Externe API

Voor het ophalen van filmgegevens is gebruikgemaakt van de API van **The Movie Database (TMDb)**.

Een API-key moet worden ingevuld bij:

```env
API_KEY=
```

---

## Applicatie starten

Wanneer alle packages zijn geïnstalleerd en het `.env` bestand is toegevoegd en ingevuld, kan de applicatie gestart worden met het volgende commando:

```bash
node server.js
```

Als jullie project een ander startbestand gebruikt, vervang `server.js` dan door de juiste bestandsnaam.

---

## Gebruikte technologieën en packages

Binnen dit project is gebruikgemaakt van de volgende technologieën en packages:

- **Node.js** - runtime environment voor JavaScript
- **Express** - framework voor de server
- **dotenv** - voor het inladen van environment variables uit het `.env` bestand
- **xss** - voor het beveiligen van gebruikersinvoer tegen XSS-aanvallen
- **validator** - voor het controleren en valideren van invoer
- **bcrypt** - voor het veilig hashen van wachtwoorden
- **multer** - voor het uploaden en verwerken van bestanden
- **MongoDB** - database voor het opslaan van gegevens
- **The Movie Database (TMDb) API** - externe API voor filmgegevens

---

## Belangrijk

Het `.env` bestand bevat gevoelige gegevens en mag daarom niet openbaar gedeeld worden. Voeg dit bestand daarom toe aan `.gitignore`.

---

## Samenvatting

Om deze applicatie te gebruiken moeten eerst de benodigde npm-packages worden geïnstalleerd. Daarna moet een `.env` bestand worden toegevoegd met de juiste variabelen. Vervolgens kan de applicatie gestart worden via Node.js.

De applicatie maakt gebruik van **MongoDB** als database en van de **TMDb API** voor externe data.
