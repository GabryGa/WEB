npm install express socket.io bcryptjs mongoose dotenv \
npm install --save-dev nodemon \
quest'ultimo riavvia automaticamente il server quando vengono apportate modifiche al codice. Viene installato come dipendenza di      sviluppo per facilitare il workflow durante la programmazione.

Per il progetto con MySQL
npm install mysql
-- Create the database
CREATE DATABASE sensori_db;

-- Use the database
USE sensori_db;

-- Create the users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Create the sensors table
CREATE TABLE sensors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    update_interval INT NOT NULL,
    current_value DECIMAL(10, 2),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

Realizzare un’applicazione one-page sfruttando le tecnologie web per realizzare una dashboard per la gestione di sensori casalinghi sfruttando la libreria SocketIO e Express. L’applicazione dovrà permettere agli utenti di
\ potersi registrare ed effettuare il login, di visualizzare i sensori al momento inseriti nel sistema e di poterne inserire di nuovi (settando nome del sensore, tipologia e tempo di aggiornamento) o eliminarli. Il server
\ potrà usare una struttura dati consona al problema come database. Per registrare l’utente occorrerà far inserire email e password. All’interno della dashboard occorrerà aggiornare i singoli sensori in funzione dell’evento
\ di aggiornamento in real time. Il server potrà simulare i sensori in funzione di un tempo e valori random. E’ possibile utilizzare qualsiasi libreria o framework grafico. Si consiglia l’ausilio della libreria Axios.