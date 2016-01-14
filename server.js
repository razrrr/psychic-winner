"use strict";

// load card data from external file - there might be a better way to do this
var cards;
var fs = require("fs");
eval(fs.readFileSync("./public/cards.js", "utf8"));
for (var id in cards) {
    cards[id].id = id;
}

// ===============
// game variables
// ===============
var gameStart = false;
var gameState = {
    phase: "action",
    players: {},
    board: [],
    revealed : [],
    trash: [],
    activePlayer: 0,
    playerOrder: [],
};

function Player(id, deck) {
    this.id = id;
    this.hand = [];
    this.discarded = [];
    this.played = [];
    this.deck = deck;
    this.coins = 0;
    this.actions = 1;
    this.buys = 1;
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
        if (gameOver()) {
            countVictoryPoints();
            io.sockets.emit("gameOver", gameState);
        }
        else {
            // move to next player
            endTurn(gameState.players[socket.id]);
            gameState.activePlayer = (gameState.activePlayer + 1) % gameState.playerOrder.length;
        }

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
            // check if there is any supply left
            if (cards[data.cardID].bankVersion.supply > 0) {
                var acquiredCard = acquire(player, data.cardID);
                if (acquiredCard) {
                    // buy the card
                    io.sockets.emit("log", player.id + " buys " + card.name);
                    gameState.phase = "buy";
                    player.coins -= card.cost;
                    player.buys--;
                    player.actions = 0;

                    // add to discard pile
                    player.discarded.push(acquiredCard);
                }
                else {
                    // notify user there are no more cards
                }
            }

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

        gameState.playerOrder = [];
        gameState.players = {};
        gameState.trash = [];
        for (var id in io.sockets.clients().sockets) {
            gameState.players[id] = new Player(id, createStartingHand());
            shuffle(gameState.players[id].deck);
            draw(gameState.players[id], 5);
            gameState.playerOrder.push(id);
        }

        // initialize board
        // select 10 random action cards
        gameState.board = initBoard();

        // !! <DEBUG> Put all cards into play. Delete this section later.
     /*   gameState.board = [];
        for (var key in cards) {
            var newCard = createCard(key);
            newCard.supply = 10;
            gameState.board.push(newCard);
            cards[key].bankVersion = newCard;
        }*/

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


function acquire(player, cardID) {
    if (cards[cardID].bankVersion.supply > 0) {
        var newCard = createCard(cardID);

        // decrease supply
        cards[cardID].bankVersion.supply--;

        return newCard;
    }
    else {
        return false;
    }
}

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
    player.actions = 1;
    player.buys = 1;
    player.coins = 0;
    clear(player);
    io.sockets.emit("gameState", gameState);
    draw(player, 5);
    gameState.phase = "action";
    io.sockets.emit("log", gameState.players[gameState.playerOrder[gameState.activePlayer]].id + "'s turn");
}

// initialize game board
function initBoard() {
    var supplySize = getSupplySize(gameState.playerOrder.length);

    var treasureCards = [];
    var victoryCards = [];
    var curseCards = [];
    var kingdomCards = [];
    for (var key in cards) {
        if (key === "copper" || key === "silver" || key === "gold") {
            var newCard = createCard(key);
            newCard.supply = supplySize[key];
            treasureCards.push(newCard);
        }
        else if (key === "estate" || key === "duchy" || key === "province") {
            var newCard = createCard(key);
            newCard.supply = supplySize[key];
            victoryCards.push(newCard);
        }
        else if (key === "curse") {
            var newCard = createCard(key);
            newCard.supply = supplySize[key];
            curseCards.push(newCard);
        }
        else {
            var newCard = createCard(key);
            if (cards[key].type === "victory") // e.g. gardens, duke
                newCard.supply = supplySize.estate;
            else
                newCard.supply = supplySize.kingdomCard;

            kingdomCards.push(newCard);;
        }
    }
    treasureCards.sort(sortCost);
    victoryCards.sort(sortCost);
    curseCards.sort(sortCost);

    shuffle(kingdomCards);
    kingdomCards = kingdomCards.splice(0, 10);
    kingdomCards.sort(sortCost);

    // add references to the "board" version of the card in the global cards variable
    var boardCards = treasureCards.concat(victoryCards, curseCards, kingdomCards);
    for (var i in boardCards) {
        cards[boardCards[i].id].bankVersion = boardCards[i];
    }
    return boardCards;
}

// helper function to sort cards by cost
function sortCost(a, b) {
    return cards[a.id].cost > cards[b.id].cost;
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

// create starting hand of player
function createStartingHand() {
    var startingHand = [];
    // add 7 coppers
    for (var i = 0; i < 7; i++) {
        startingHand.push(createCard("copper"));
    }
    // add 3 estates
    for (i = 0; i < 3; i++) {
        startingHand.push(createCard("estate"));
    }

    return startingHand;
}

// defines supply sizes based on the number of players
function getSupplySize(numPlayers) {
    var supplySize = {
        estate: 10,
        duchy: 10,
        province: 10,
        colony: 10,
        curse: 10,
        copper: 10,
        silver: 10,
        gold: 10,
        platinum: 10,
        kingdomCard: 10,
    };

    switch (numPlayers) {
        case 2:
            supplySize.estate = 8;
            supplySize.duchy = 8;
            supplySize.province = 8;
            supplySize.colony = 8;
            supplySize.curse = 10;
            supplySize.copper = (60 - 7*numPlayers);
            supplySize.silver = 40;
            supplySize.gold = 30;
            break;
        case 3:
            supplySize.estate = 12;
            supplySize.duchy = 12;
            supplySize.province = 12;
            supplySize.colony = 12;
            supplySize.curse = 20;
            supplySize.copper = (60 - 7*numPlayers);
            supplySize.silver = 40;
            supplySize.gold = 30;
            break;
        case 4:
            supplySize.estate = 12;
            supplySize.duchy = 12;
            supplySize.province = 12;
            supplySize.colony = 12;
            supplySize.curse = 30;
            supplySize.copper = (60 - 7*numPlayers);
            supplySize.silver = 40;
            supplySize.gold = 30;
            break;
        case 5:
            supplySize.estate = 12;
            supplySize.duchy = 12;
            supplySize.province = 15;
            supplySize.colony = 12;
            supplySize.curse = 40;
            supplySize.copper = (120 - 7*numPlayers);
            supplySize.silver = 80;
            supplySize.gold = 60;
            break;
        case 6:
            supplySize.estate = 12;
            supplySize.duchy = 12;
            supplySize.province = 18;
            supplySize.colony = 12;
            supplySize.curse = 50;
            supplySize.copper = (120 - 7*numPlayers);
            supplySize.silver = 80;
            supplySize.gold = 60;
            break;
        default:
            // !! better way of handling?
            break;
    }

    return supplySize;
}

function gameOver() {
    // end game conditions
        // 2-4 players - 3 piles are empty
        // 5-6 players - 4 piles are empty
    // provinces are gone
    // colonies are gone

    var numPlayers = gameState.playerOrder.length;
    var pileLimit;
    if (numPlayers <= 4)
        pileLimit = 3;
    else
        pileLimit = 4;

    var pileCount = 0;
    for (var i in gameState.board) {
        if (gameState.board[i].supply === 0) {
            pileCount++;
            if (gameState.board[i].id === "province" || gameState.board[i].id === "colony") pileCount = pileLimit;
        }
    }

    if (pileCount >= pileLimit) return true;

    return false;
}

function countVictoryPoints() {
    var winners = [];
    var winnerScore = 0;

    for (var p in gameState.players) {
        var player = gameState.players[p];
        player.deck = player.deck.concat(player.hand, player.discarded, player.played);

        // calculate victory points
        var totalVictoryPoints = 0;
        for (var c in player.deck) {
            var card = cards[player.deck[c].id];
            if (card.type.indexOf("victory") >= 0) {
                totalVictoryPoints += card.victory(player);
            }
        }

        // determine winner
        player.totalVictoryPoints = totalVictoryPoints;
        if (totalVictoryPoints > winnerScore) {
            winners = [];
            winners.push(player.id);
            winnerScore = totalVictoryPoints;
        }
        else if (totalVictoryPoints === winnerScore) {
            winners.push(player.id);
        }

        io.sockets.emit("log", player.id + " has " + totalVictoryPoints + " victory points!");
    }

    // list all winners
    for (var i in winners) {
        io.sockets.emit("log", winners[i] + " wins!");
    }
}