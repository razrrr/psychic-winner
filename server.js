"use strict";

// load card data from external file - there might be a better way to do this
var cards;
var fs = require("fs");
eval(fs.readFileSync("./public/cards.js", "utf8"));

// ===============
// game variables
// ===============
var gameStart = false;
var gameState = {
    phase: "action",
    players: {},
    board: [],
    trash: [],
    activePlayer: 0,
    playerOrder: [],
};

function Player(id, deck) {
    this.id = id;
    this.hand = [];
    this.discarded = [];
    this.played = [];
    this.revealed = [];
    this.deck = deck;
    this.coins = 0;
    this.actions = 1;
    this.buys = 1;
}

function createStartingHand() {
    var startingHand = [];
    // add 7 coppers
    for (var i = 1; i <= 7; i++) {
        startingHand.push(createCard("copper"));
    }
    // add 3 estates
    for (var i = 1; i <= 3; i++) {
        startingHand.push(createCard("estate"));
    }

    return startingHand;
}

// ===============
// start the server
// ===============
var express = require("express");
var path = require("path");
var app = express();
app.use(express.static(path.join(__dirname, "public")));
var server = require("http").createServer(app).listen(process.env.PORT || 8081);
var io = require("socket.io").listen(server);

// ===============
// listen for connections
// ===============
io.sockets.on("connection", function(socket) {
    io.sockets.emit("log", socket.id + " connected");
    // ----------------
    // Received endTurn message from client
    // ----------------
    socket.on("endTurn", function() {
        // !! need to validate active player
        endTurn(gameState.players[socket.id]);
        gameState.activePlayer = (gameState.activePlayer + 1) % gameState.playerOrder.length;

        io.sockets.emit("gameState", gameState);
    });
    // ----------------
    // Received buy message from client
    // ----------------
    socket.on("buy", function(data) {
        // need to validate active player
        var player = gameState.players[socket.id];
        var card = cards[data.cardID];
        if (player.coins >= card.cost && player.buys > 0) {
            io.sockets.emit("log", player.id + " buys " + card.name);
            gameState.phase = "buy";
            player.coins -= card.cost;
            player.buys--;
            player.actions = 0;
            var newCard = createCard(data.cardID);
            player.discarded.push(newCard);
            io.sockets.emit("gameState", gameState);
        }
    });
    // ----------------
    // Received action message from client
    // ----------------
    socket.on("play", function(data) {
        // need to validate active player
        var player = gameState.players[socket.id];
        var card = cards[data.cardID];
        if (player.actions > 0 && card.type.indexOf("action") >= 0) {
            io.sockets.emit("log", player.id + " plays " + card.name);
            player.actions--;
            player.played.push(player.hand[data.cardIndex]);
            player.hand.splice(data.cardIndex, 1);
            card.action(player);
            io.sockets.emit("gameState", gameState);
        }
        if (card.type.indexOf("treasure") >= 0) {
            io.sockets.emit("log", player.id + " plays " + card.name);
            gameState.phase = "buy";
            player.played.push(player.hand[data.cardIndex]);
            player.hand.splice(data.cardIndex, 1);
            card.action(player);
            io.sockets.emit("gameState", gameState);
        }
    });
    // ----------------
    // Received startGame message from client
    // ----------------
    socket.on("startGame", function() {
        gameStart = true;
        io.sockets.emit("log", "game started");

        // initialize board
        // select 10 random action cards
        gameState.board = initBoard();

        // !! <DEBUG> Put all cards into play. Delete this section later.
        gameState.board = [];
        for (var key in cards) {
            gameState.board.push(cards[key]);
        }

        gameState.playerOrder = [];
        gameState.players = {};
        gameState.trash = [];
        for (var id in io.sockets.clients().sockets) {
            gameState.players[id] = new Player(id, createStartingHand());
            shuffle(gameState.players[id].deck);
            draw(gameState.players[id], 5);
            gameState.playerOrder.push(id);
        }

        io.sockets.emit("gameState", gameState);
    });
    // ----------------
    // Received select message from client
    // ----------------
    socket.on("select", function(data) {
        // need to validate active player
        gameState.queryData.callback(data);
    });
    // ----------------
    // Received callback message from client
    // ----------------
    socket.on("callback", function(data) {
        // need to validate active player
        gameState.queryData.callback(data);
    });
    // ----------------
    // Received disconnect message from client
    // ----------------
    socket.on("disconnect", function() {
        io.sockets.emit("message", {
            msg: socket.id,
            id: "server : disconnect"
        });
    });
});

// ===============
// utility functions
// ===============

// generates unique identifiers
var uniqueID = (function() {
   var id = 0;
   return function() { return id++; };
})();

// create a new card on the game board
function createCard(id) {
    var newCard = {};
    newCard.id = id;
    newCard.uid = uniqueID();
    return newCard;
}

// reset player properties at the end of their turn
function endTurn(player) {
    io.sockets.emit("log", player.id + " ends their turn");
    player.actions = 12;
    player.buys = 12;
    player.coins = 120;
    clear(player);
    draw(player, 5);
    gameState.phase = "action";
    io.sockets.emit("log", gameState.players[gameState.playerOrder[gameState.activePlayer]].id + "'s turn");
}

// initialize game board
function initBoard() {
    var treasureCards = [];
    var victoryCards = [];
    var curseCards = [];
    var bankCards = [];
    for (var key in cards) {
        if (key === "copper" || key === "silver" || key === "gold") {
            treasureCards.push(cards[key]);
        }
        else if (key === "estate" || key === "duchy" || key === "province") {
            victoryCards.push(cards[key]);
        }
        else if (key === "curse") {
            curseCards.push(cards[key]);
        }
        else {
            bankCards.push(cards[key]);
        }
    }
    treasureCards.sort(sortCost);
    victoryCards.sort(sortCost);
    curseCards.sort(sortCost);

    shuffle(bankCards);
    bankCards = bankCards.splice(0, 10);
    bankCards.sort(sortCost);

    return treasureCards.concat(victoryCards, curseCards, bankCards);
}

// helper function to sort cards by cost
function sortCost(a, b) {
    return a.cost > b.cost;
}
// draw cards from a players deck
function draw(player, numCards) {
    var actualDrawn = 0;
    while (numCards > 0) {
        if (player.deck.length === 0) {
            if (actualDrawn > 0) io.sockets.emit("log", player.id + " draws " + actualDrawn + " cards");
            actualDrawn = 0;
            reload(player);
        }
        if (player.deck.length > 0) player.hand.push(player.deck.pop());
        actualDrawn++;
        numCards--;
    }
    io.sockets.emit("log", player.id + " draws " + actualDrawn + " cards");
}

// move cards from hand, played, and revealed to discard pile - used for end of turn... but where else? merge with endTurn if nowhere
function clear(player) {
    while (player.hand.length > 0) {
        player.discarded.push(player.hand.pop());
    }
    while (player.played.length > 0) {
        player.discarded.push(player.played.pop());
    }
    while (player.played.length > 0) {
        player.discarded.push(player.revealed.pop());
    }
}

// move cards from discard pile to deck and shuffle
function reload(player) {
    while (player.discarded.length > 0) {
        player.deck.push(player.discarded.pop());
    }
    shuffle(player.deck);
    io.sockets.emit("log", player.id + " shuffles their discard pile into their deck");
}

// shuffles an array of cards
function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}