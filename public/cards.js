var cards = {
    "copper": {
        expansion: "Core",
        name: "Copper",
        type: "treasure",
        image: "http://i.imgur.com/8jlCjyp.png",
        description: "+1 Coins.",
        cost: 0,
        value: 1,
        victory: function(player) { return 0; },
        action: function(player) {
            player.coins += this.value;
            io.sockets.emit("log", " ... and gets 1 coin");
            gameState.phase = "buy";
        }
    },
    "silver": {
        expansion: "Core",
        name: "Silver",
        image: "http://i.imgur.com/8jlCjyp.png",
        type: "treasure",
        description: "+2 Coins.",
        cost: 3,
        value: 2,
        victory: function(player) { return 0; },
        action: function(player) {
            player.coins += this.value;
            io.sockets.emit("log", " ... and gets 2 coins");
            gameState.phase = "buy";
        }
    },
    "gold": {
        expansion: "Core",
        name: "Gold",
        image: "http://i.imgur.com/8jlCjyp.png",
        type: "treasure",
        description: "+3 Coins.",
        cost: 6,
        value: 3,
        victory: function(player) { return 0; },
        action: function(player) {
            player.coins += this.value;
            io.sockets.emit("log", " ... and gets 3 coins");
            gameState.phase = "buy";
        }
    },
    "estate": {
        expansion: "Core",
        name: "Estate",
        image: "http://i.imgur.com/z5FAZ4K.jpg",
        type: "victory",
        description: "+1 Victory.",
        cost: 2,
        value: 0,
        victory: function(player) { return 1; }
    },
    "duchy": {
        expansion: "Core",
        name: "Duchy",
        image: "http://i.imgur.com/z5FAZ4K.jpg",
        type: "victory",
        description: "+3 Victory.",
        cost: 5,
        value: 0,
        victory: function(player) { return 3; }
    },
    "province": {
        expansion: "Core",
        name: "Province",
        image: "http://i.imgur.com/z5FAZ4K.jpg",
        type: "victory",
        description: "+6 Victory.",
        cost: 8,
        value: 0,
        victory: function(player) { return 6; }
    },
    "curse": {
        expansion: "Core",
        name: "Curse",
        type: "curse",
        description: "-1 Victory.",
        cost: 0,
        value: 0,
        victory: function(player) { return -1; }
    },
    "mine": {
        expansion: "Base",
        description: "Trash a Treasure card from your hand. Gain a Treasure card costing up to 3 Coins more; put it into your hand.",
        name: "Mine",
        type: "action",
        cost: 5,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card.treasure",
                number: 1,
                unique: true,
                exact: false,
                selected: [],
                callback: function(data) {
                    for (var i in data) {
                        var cardIndex = data[0].index;
                        var cost = cards[player.hand[cardIndex].id].cost;
                        var query = ".buyable .card.treasure.COST0";
                        for (var j = 1; j <= cost + 3; j++) {
                            query += ", .buyable .card.treasure.COST" + j;
                        }
                        gameState.trash.push(player.hand[cardIndex]);
                        player.hand.splice(cardIndex, 1);
                        gameState.phase = "select";
                        gameState.queryData = {
                            eligible: query,
                            number: 1,
                            unique: true,
                            exact: false,
                            selected: [],
                            callback: function(data) {
                                player.hand.push(data[0].card);
                                gameState.phase = "action";
                                io.sockets.emit("gameState", gameState);
                            }
                        };
                        io.sockets.emit("gameState", gameState);
                    }
                    if (data.length === 0) {
                        gameState.phase = "action";
                        io.sockets.emit("gameState", gameState);
                    }
                }
            };
        }
    },
    "village": {
        expansion: "Base",
        name: "Village",
        description: "+1 Card; +2 Actions.",
        type: "action",
        cost: 3,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 1);
            player.actions += 2;
        }
    },
    "workshop": {
        expansion: "Base",
        description: "Gain a card costing up to 4 Coins.",
        name: "Workshop",
        type: "action",
        cost: 3,
        image: "http://i.imgur.com/GvrGyRa.jpg",
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".buyable .card.COST4, .buyable .card.COST3, .buyable .card.COST2, .buyable .card.COST1, .buyable .card.COST0",
                number: 1,
                unique: true,
                exact: true,
                selected: [],
                callback: function(data) {
                    var acquiredCard = acquire(player, data[0].card.id);
                    io.sockets.emit("log", " ... and gets " + cards[acquiredCard.id].name);
                    player.discarded.push(acquiredCard);
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            };
        }
    },
    "chapel": {
        expansion: "Base",
        description: "Trash up to 4 Cards from your hand.",
        name: "Chapel",
        type: "action",
        cost: 2,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card",
                number: 4,
                unique: true,
                exact: false,
                selected: [],
                callback: function(data) {
                    var targetCardIndices = [];
                    for (var i in data) {
                        targetCardIndices.push(data[i].index);
                    }
                    targetCardIndices.sort(function(a, b) {
                        return b - a;
                    });
                    for (var i = 0; i < targetCardIndices.length; i++) {
                        var cardIndex = targetCardIndices[i];
                        io.sockets.emit("log", " ... and trashes " + cards[player.hand[cardIndex].id].name);
                        gameState.trash.push(player.hand[cardIndex]);
                        player.hand.splice(cardIndex, 1);
                    }
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            };
        }
    },
    "moneylender": {
        expansion: "Base",
        description: "Trash a Copper from your hand. If you do, +3 Coins.",
        name: "Moneylender",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card.IDcopper",
                number: 1,
                unique: true,
                exact: false,
                selected: [],
                callback: function(data) {
                    for (var i in data) {
                        io.sockets.emit("log", " ... and trashes a copper for 3 treasure ");
                        var cardIndex = data[0].index;
                        gameState.trash.push(player.hand[cardIndex]);
                        player.hand.splice(cardIndex, 1);
                        player.coins += 3;
                    }
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            };
        }
    },
    "smithy": {
        expansion: "Base",
        description: "Draw 3 cards.",
        name: "Smithy",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 3);
        }
    },
    "woodcutter": {
        expansion: "Base",
        id: "woodcutter",
        description: "+1 Buy, +2 Coins.",
        name: "Woodcutter",
        type: "action",
        cost: 3,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            player.buys += 1;
            player.coins += 2;
        }
    },
    "festival": {
        expansion: "Base",
        description: "+2 Actions, +1 Buy, +2 Coins.",
        name: "Festival",
        type: "action",
        cost: 5,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            player.buys += 1;
            player.actions += 2;
            player.coins += 2;
        }
    },
    "laboratory": {
        expansion: "Base",
        description: "+2 Cards, +1 Action.",
        name: "Laboratory",
        type: "action",
        cost: 5,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 2);
            player.actions += 1;
        }
    },
    "market": {
        expansion: "Base",
        description: "+1 Card, +1 Action, +1 Buy, +1 Coin.",
        name: "Market",
        type: "action",
        cost: 5,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 1);
            player.buys += 1;
            player.actions += 1;
            player.coins += 1;
        }
    },
    "great hall": {
        expansion: "Intrigue",
        description: "1 Victory, +1 Card, +1 Action.",
        name: "Great Hall",
        type: "action victory",
        cost: 3,
        value: 0,
        victory: function(player) { return 1; },
        action: function(player) {
            draw(player, 1);
            player.actions += 1;
        }
    },
    "shanty town": {
        expansion: "Intrigue",
        description: "+2 Actions, Reveal your hand. If you have no Action cards in hand, +2 Cards.",
        name: "Shanty Town",
        type: "action",
        cost: 3,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            player.actions += 2;
            //Still needs reveal function
            var hasNoActions = true;
            for (var cardRef in player.hand) {
                if (cards[player.hand[cardRef].id].type.indexOf("action") >= 0) hasNoActions = false;
            }
            if (hasNoActions) draw(player, 2);
        }
    },
    "ironworks": {
        expansion: "Intrigue",
        description: "Gain a card costing up to 4 Coins. If it is an... Action card, +1 Action. Treasure card, +1 Coin. Victory card, +1 Card.",
        name: "Ironworks",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".buyable .card.COST4, .buyable .card.COST3, .buyable .card.COST2, .buyable .card.COST1, .buyable .card.COST0",
                number: 1,
                unique: true,
                exact: true,
                selected: [],
                callback: function(data) {
                    var acquiredCard = acquire(player, data[0].card.id);
                    io.sockets.emit("log", " ... and gets " + cards[acquiredCard.id].name);
                    player.discarded.push(acquiredCard);

                    gameState.phase = "action";
                    if (cards[acquiredCard.id].type.indexOf("action") >= 0) {
                        player.actions += 1;
                        io.sockets.emit("log", " ... and gets +1 Action");
                    }
                    if (cards[acquiredCard.id].type.indexOf("treasure") >= 0) {
                        player.coins = +1;
                        io.sockets.emit("log", " ... and gets +1 Coin");
                    }
                    if (cards[acquiredCard.id].type.indexOf("victory") >= 0) {
                        draw(player, 1);
                        io.sockets.emit("log", " ... and gets +1 Card");
                    }
                    io.sockets.emit("gameState", gameState);
                }
            };
        }
    },
    "chancellor": {
        expansion: "Intrigue",
        description: "+2 Coins, You may immediately put your deck into your discard pile.",
        name: "Chancellor",
        type: "action",
        cost: 3,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            player.coins += 2;
            gameState.phase = "choose";
            gameState.queryData = {
                number: 1,
                exact: true,
                message: "Put your deck into your discard pile?",
                choices: ["Yes", "No"],
                selected: [],
                callback: function(choiceIndexArray) {
                    if (choiceIndexArray[0] === 0) {
                        while (player.deck.length > 0) {
                            player.discarded.push(player.deck.pop());
                        }
                    };
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            };
        }
    },
    "pawn": {
        expansion: "Intrigue",
        description: "Choose two: +1 Card, +1 Action, +1 Buy, +1 Coin. (The choices must be different).",
        name: "Pawn",
        type: "action",
        cost: 2,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "choose";
            gameState.queryData = {
                number: 2,
                exact: true,
                message: "Choose two (the choices must be different).",
                choices: ["+1 Card", "+1 Action", "+1 Buy", "+1 Coin"],
                selected: [],
                callback: function(choiceIndexArray) {
                    for (var i = 0; i < choiceIndexArray.length; i++) {
                        if (choiceIndexArray[i] === 0) draw(player, 1);
                        if (choiceIndexArray[i] === 1) {
                            player.actions += 1;
                            io.sockets.emit("log", " gains +1 Action.");
                        }
                        if (choiceIndexArray[i] === 2) {
                            player.buys += 1;
                            io.sockets.emit("log", " gains +1 Buy.");
                        }
                        if (choiceIndexArray[i] === 3) {
                            player.coins += 1;
                            io.sockets.emit("log", " gains +1 Coin.");
                        }
                        gameState.phase = "action";
                        io.sockets.emit("gameState", gameState);
                    }
                }
            };
        }
    },
    "steward": {
        expansion: "Intrigue",
        description: "Choose one: +2 Cards; or +2 Coins; or trash 2 cards from your hand.",
        name: "Steward",
        type: "action",
        cost: 3,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "choose";
            gameState.queryData = {
                number: 1,
                exact: true,
                message: "Choose one.",
                choices: ["+2 Cards", "+2 Coins", "Trash 2 cards from your hand"],
                selected: [],
                callback: function(choiceIndexArray) {
                    for (var i = 0; i < choiceIndexArray.length; i++) {
                        if (choiceIndexArray[i] === 0) {
                            draw(player, 2);
                            gameState.phase = "action";
                        } else if (choiceIndexArray[i] === 1) {
                            player.coins += 2;
                            io.sockets.emit("log", " gains +2 Coins.");
                            gameState.phase = "action";
                        } else if (choiceIndexArray[i] === 2) {
                            gameState.phase = "select";
                            gameState.queryData = {
                                eligible: ".your.player .hand .card",
                                number: 2,
                                unique: true,
                                exact: true,
                                selected: [],
                                callback: function(data) {
                                    var targetCardIndices = [];
                                    for (var i in data) {
                                        targetCardIndices.push(data[i].index);
                                    }
                                    targetCardIndices.sort(function(a, b) {
                                        return b - a;
                                    });
                                    for (var i = 0; i < targetCardIndices.length; i++) {
                                        var cardIndex = targetCardIndices[i];
                                        io.sockets.emit("log", " ... and trashes " + cards[player.hand[cardIndex].id].name);
                                        gameState.trash.push(player.hand[cardIndex]);
                                        player.hand.splice(cardIndex, 1);
                                    }
                                    gameState.phase = "action";
                                    io.sockets.emit("gameState", gameState);
                                }
                            }
                        }
                        io.sockets.emit("gameState", gameState);
                    }
                }
            };
        }
    },
    "remodel": {
        expansion: "Intrigue",
        description: "Trash a card from your hand. Gain a card costing up to 2 Coins more than the trashed card.",
        name: "Remodel",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card",
                number: 1,
                unique: true,
                exact: false,
                selected: [],
                callback: function(data) {
                    for (var i in data) {
                        var cardIndex = data[0].index;
                        var cost = cards[player.hand[cardIndex].id].cost;
                        var query = ".buyable .card.COST0";
                        for (var j = 1; j <= cost + 2; j++) {
                            query += ", .buyable .card.COST" + j;
                        }
                        io.sockets.emit("log", cards[player.hand[cardIndex].id].name + " was trashed.");
                        gameState.trash.push(player.hand[cardIndex]);
                        player.hand.splice(cardIndex, 1);
                        gameState.phase = "select";
                        gameState.queryData = {
                            eligible: query,
                            number: 1,
                            unique: true,
                            exact: false,
                            selected: [],
                            callback: function(data) {
                                io.sockets.emit("log", " ... and gets " + data[0].card.name);
                                player.discarded.push(data[0].card);
                                gameState.phase = "action";
                                io.sockets.emit("gameState", gameState);
                            }
                        };
                        io.sockets.emit("gameState", gameState);
                    }
                    if (data.length === 0) {
                        gameState.phase = "action";
                        io.sockets.emit("gameState", gameState);
                    }
                }
            };
        }
    },
    "mining village": {
        expansion: "Intrigue",
        description: "+1 Card, +2 Actions. You may trash this card immediately. If you do, +2 Coins.",
        name: "Mining Village",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 1);
            player.actions += 2;
            gameState.phase = "choose";
            gameState.queryData = {
                number: 1,
                exact: true,
                message: "Would you like to trash Mining Village for +2 Coins?",
                choices: ["Yes", "No"],
                selected: [],
                callback: function(choiceIndexArray) {
                    if (choiceIndexArray[0] === 0) {
                        gameState.trash.push(player.played.pop());
                        player.coins += 2;
                    };
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            };
        }
    },
    "upgrade": {
        expansion: "Intrigue",
        description: "+1 Card, +1 Action, Trash a card from your hand. Gain a card costing exactly 1 Coin more than it.",
        name: "Upgrade",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 1);
            player.actions += 1;
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card",
                number: 1,
                unique: true,
                exact: false,
                selected: [],
                callback: function(data) {
                    for (var i in data) {
                        var cardIndex = data[0].index;
                        var cost = cards[player.hand[cardIndex].id].cost;
                        var query = ".buyable .card.COST" + (cost + 1);
                        io.sockets.emit("log", cards[player.hand[cardIndex].id].name + " was trashed.");
                        gameState.trash.push(player.hand[cardIndex]);
                        player.hand.splice(cardIndex, 1);
                        gameState.phase = "select";
                        gameState.queryData = {
                            eligible: query,
                            number: 1,
                            unique: true,
                            exact: false,
                            selected: [],
                            callback: function(data) {
                                if (data[0]) {
                                    io.sockets.emit("log", " ... and gets " + data[0].card.name);
                                    player.discarded.push(data[0].card);
                                }
                                gameState.phase = "action";
                                io.sockets.emit("gameState", gameState);
                            }
                        };
                        io.sockets.emit("gameState", gameState);
                    }
                    if (data.length === 0) {
                        gameState.phase = "action";
                        io.sockets.emit("gameState", gameState);
                    }
                }
            };
        }
    },
    "nobles": {
        expansion: "Intrigue",
        description: "+2 Victory, Choose one: +3 Cards, or +2 Actions.",
        name: "Nobles",
        type: "action victory",
        cost: 6,
        value: 0,
        victory: function(player) { return 2; },
        action: function(player) {
            gameState.phase = "choose";
            gameState.queryData = {
                number: 1,
                exact: true,
                message: "Choose one.",
                choices: ["+3 Cards", "+2 Actions"],
                selected: [],
                callback: function(choiceIndexArray) {
                    for (var i = 0; i < choiceIndexArray.length; i++) {
                        if (choiceIndexArray[i] === 0) draw(player, 3);
                        if (choiceIndexArray[i] === 1) {
                            player.actions += 2;
                            io.sockets.emit("log", " gains +2 Actions.");
                        }
                        gameState.phase = "action";
                        io.sockets.emit("gameState", gameState);
                    }
                }
            };
        }
    },
    "harem": {
        expansion: "Intrigue",
        description: "+2 Coins, +2 Victory.",
        name: "Harem",
        type: "treasure victory",
        cost: 6,
        value: 2,
        victory: function(player) { return 2; },
        action: function(player) {
            player.coins += this.value;
            io.sockets.emit("log", " ... and gets 2 coins");
            gameState.phase = "buy";
        }
    },
    "council room": {
        expansion: "Base",
        description: "+4 Cards, +1 Buy, Each other player draws a card.",
        name: "Council Room",
        type: "action",
        cost: 5,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            draw(player, 4);
            player.buys += 1;
            for (var pid in gameState.players) {
                var aPlayer = gameState.players[pid];
                if (aPlayer.id != player.id) draw(aPlayer, 1);
                io.sockets.emit("log", " Each other player drew 1 Card.")
            }
        }
    },
    "conspirator": {
        expansion: "Intrigue",
        description: "+2 Coins. If you've played 3 or more Actions this turn (including this); +1 Card, +1 Action.",
        name: "Conspirator",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            player.coins += 2;
            io.sockets.emit("log", " ... and gets 2 coins");
            var counter = 0;
            for (var i = 0; i < player.played.length; i++) {
                if (cards[player.played[i].id].type.indexOf("action") >= 0) counter++;
            }
            if (counter >= 3) {
                draw(player, 1);
                player.actions += 1;
                io.sockets.emit("log", " ... and gains +1 Action.");
            }
        }
    },
    "militia": {
        expansion: "Base",
        description: "+2 Coins, Each other player discards down to 3 cards in his hand.",
        name: "Militia",
        type: "action attack",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            // save current player id so we know when all players have been attacked
            var currentPlayer = gameState.activePlayer;

            gameState.phase = "select";
            gameState.activePlayer = (gameState.activePlayer + 1) % gameState.playerOrder.length;
            var attack = function() {
                var playerData = gameState.players[gameState.playerOrder[gameState.activePlayer]];
                var discardTo = playerData.hand.length - 3;
                if (discardTo < 0) discardTo = 0;
                gameState.queryData = {
                    eligible: ".your.player .hand .card",
                    number: discardTo,
                    unique: true,
                    exact: true,
                    message: "Select cards to discard",
                    selected: [],
                    callback: function(data) {
                        var targetCardIndices = [];
                        for (var i in data) {
                            targetCardIndices.push(data[i].index);
                        }
                        targetCardIndices.sort(function(a, b) {
                            return b - a;
                        });
                        for (var i = 0; i < targetCardIndices.length; i++) {
                            var cardIndex = targetCardIndices[i];
                            playerData.discarded.push(playerData.hand[cardIndex]);
                            io.sockets.emit("log", " ... " + playerData.id + " discards " + cards[playerData.hand[cardIndex].id].name);
                            playerData.hand.splice(cardIndex, 1);
                        }
                        gameState.activePlayer = (gameState.activePlayer + 1) % gameState.playerOrder.length;
                        if (gameState.activePlayer === currentPlayer) {
                            player.coins += 2;
                            gameState.phase = "action";
                            io.sockets.emit("gameState", gameState);
                        } else {
                            attack();
                            io.sockets.emit("gameState", gameState);
                        }
                    }
                };
            }
            attack();
        }
    },
    "adventurer": {
        expansion: "Base",
        name: "Adventurer",
        description: "ARBLGARBL",
        type: "action",
        cost: 6,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            var revealedTreasures = 0;
            var revealedCard;

            var seekTreasure = function() {
                if (player.deck.length > 0) {
                    revealedCard = player.deck.pop();
                    if (cards[revealedCard.id].type.indexOf("treasure") >= 0) {
                        io.sockets.emit("log", " ... puts " + cards[revealedCard.id].name + " into hand");
                        gameState.revealed.push(revealedCard);
                        revealedTreasures++;

                        gameState.phase = "choose";
                        gameState.queryData = {
                            number: 1,
                            exact: true,
                            message: "HEERS YO TREASURES #" + revealedTreasures,
                            choices: ["ok"],
                            selected: [],
                            callback: function() {
                                player.hand.push(gameState.revealed.pop());
                                if (revealedTreasures < 2) {
                                    seekTreasure();
                                } else {
                                    while (gameState.revealed.length > 0) {
                                        player.discarded.push(gameState.revealed.pop());
                                    }
                                    gameState.phase = "action";
                                    io.sockets.emit("gameState", gameState);
                                }
                            }
                        };
                        io.sockets.emit("gameState", gameState);
                    } else {
                        gameState.revealed.push(revealedCard);
                        io.sockets.emit("log", " ... reveals " + cards[revealedCard.id].name);
                        seekTreasure();
                    }
                } else {
                    if (player.discarded.length > 0) {
                        reload(player);
                        seekTreasure();
                    } else {
                        revealedTreasures = 2;
                    }
                }
            };
            seekTreasure();
        }
    },
    "cellar": {
        description: "+1 Action, Discard any number of cards. +1 Card per card discarded.",
        name: "Cellar",
        type: "action",
        cost: 2,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card",
                number: player.hand.length,
                unique: true,
                exact: false,
                selected: [],
                callback: function(data) {
                    var targetCardIndices = [];
                    for (var i in data) {
                        targetCardIndices.push(data[i].index);
                    }
                    targetCardIndices.sort(function(a, b) {
                        return b - a;
                    });
                    for (var i = 0; i < targetCardIndices.length; i++) {
                        var cardIndex = targetCardIndices[i];
                        io.sockets.emit("log", " ... and discards " + cards[player.hand[cardIndex].id].name);
                        player.discarded.push(player.hand[cardIndex]);
                        player.hand.splice(cardIndex, 1);
                    }
                    draw(player, data.length);
                    player.actions += 1;
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            }
        }
    },
    "scout": {
        description: "+1 Action. Reveal the top 4 cards of your deck. Put the revealed Victory cards into your hand. Put the other cards on top of your deck in any order.",
        name: "Scout",
        type: "action",
        cost: 4,
        value: 0,
        victory: function(player) { return 0; },
        action: function(player) {
            player.actions += 1;
            var victoryCount = 0;
            for (var i = 0; i < 4; i++) {
                if (player.deck.length <= 0) reload(player);
                var revealedCard = player.deck.pop();
                if (cards[revealedCard.id].type.indexOf("victory") >= 0) victoryCount++;
                gameState.revealed.push(revealedCard);
            }
            gameState.phase = "choose";
            gameState.queryData = {
                number: 1,
                exact: true,
                message: "",
                choices: ["OK"],
                selected: [],
                callback: function(choiceIndexArray) {
                    for (var i = 0; i < gameState.revealed.length; i++) {
                        if (cards[gameState.revealed[i].id].type.indexOf("victory") >= 0) {
                            player.hand.push(gameState.revealed[i]);
                            gameState.revealed.splice(i, 1);
                            i--;
                        }
                    }
                    //  Can we make it so the UI updates which cards get put on deck per card clicked on
                    if (gameState.revealed.length > 0) {
                        gameState.phase = "select";
                        gameState.queryData = {
                            eligible: ".revealed .card",
                            number: gameState.revealed.length,
                            unique: true,
                            exact: true,
                            selected: [],
                            callback: function(data) {
                                var targetCardIndices = [];
                                for (var i in data) {
                                    targetCardIndices.push(data[i].index);
                                }
                                for (var i = 0; i < targetCardIndices.length; i++) {
                                    var cardIndex = targetCardIndices[i];
                                    io.sockets.emit("log", " ... and puts " + cards[gameState.revealed[cardIndex].id].name + " on top of deck");
                                    player.deck.push(gameState.revealed[cardIndex]);
                                }
                                gameState.revealed = [];
                                gameState.phase = "action";
                                io.sockets.emit("gameState", gameState);
                            }
                        }
                    } else gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            }
            if (victoryCount > 0) gameState.queryData.message = "Put revealed Victory cards into hand.";
            else gameState.queryData.message = "No Victory cards were revealed.";
        }
    },
    "courtyard": {
        description: "+3 Cards, Put a card from your hand on top of your deck.",
        name: "Courtyard",
        type: "action",
        cost: 2,
        value: 0,
        victory: 0,
        action: function(player) {
            draw(player, 3);
            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".your.player .hand .card",
                message: "Select a card from your hand on top of your deck.",
                number: 1,
                unique: true,
                exact: true,
                selected: [],
                callback: function(data) {
                    player.deck.push(cards[data[0].card.id]);
                    player.hand.splice(data[0].index, 1);
                    io.sockets.emit("log", "... and puts 1 card from hand on top of deck.");
                    gameState.phase = "action";
                    io.sockets.emit("gameState", gameState);
                }
            }
        }
    },
    "gardens": {
        description: "Worth 1 Victory for every 10 cards in your deck (rounded down).",
        name: "Gardens",
        type: "victory",
        cost: 4,
        value: 0,
        victory: function(player) {
            return Math.floor(player.deck.length / 10);
        }
    },
    "baron": {
        id: "baron",
        expansion: "Intrigue",
        description: "+1 Buy, you may discard an Estate card. If you do, +4 coins. Otherwise, gain an Estate card.",
        name: "Baron",
        type: "action",
        cost: 4,
        value: 0,
        victory: 0,
        action: function(player) {
            var estateNotFound = true;
            player.buys += 1;
            for (var i = 0; i < player.hand.length; i++) {
                if (player.hand[i].id === "estate") {
                    estateNotFound = false;
                    i = player.hand.length;
                    gameState.phase = "choose";
                    gameState.queryData = {
                        number: 1,
                        exact: true,
                        message: "Choose one.",
                        choices: ["Discard an Estate and +4 Coins", "Gain an Estate"],
                        selected: [],
                        callback: function(choiceIndexArray) {
                            if (choiceIndexArray[0] === 0) {
                                for (var j = 0; j < player.hand.length; j++) {
                                    if (player.hand[j].id === "estate") {
                                        player.discarded.push(player.hand[j]);
                                        player.hand.splice(j, 1);
                                        j = player.hand.length;
                                    }
                                }
                                player.coins += 4;
                                io.sockets.emit("log", " discards an Estate and gains +4 Coins.")
                                gameState.phase = "action";
                                io.sockets.emit("gameState", gameState);
                            }
                            else if (choiceIndexArray[0] === 1) {
                                var acquiredCard = acquire(player, "estate");
                                player.discarded.push(acquiredCard);
                                io.sockets.emit("log", " gains an Estate.");
                                gameState.phase = "action";
                                io.sockets.emit("gameState", gameState);
                            }
                        }
                    }
                }
            };
            if (estateNotFound) {
                var acquiredCard = acquire(player, "estate");
                player.discarded.push(acquiredCard);
                io.sockets.emit("log", " gains an Estate.");
                gameState.phase = "action";
                io.sockets.emit("gameState", gameState);
            }
        }
    },
    "wishing well": {
        expansion: "Intrigue",
        name: "Wishing Well",
        description: "+1 Card, +1 Action, Name a card, then reveal the top card of your deck. If it is the named card, put it in your hand.",
        type: "action",
        cost: 3,
        value: 0,
        victory: 0,
        action: function(player) {
            var namedCard;
            draw(player, 1);
            player.actions += 1
            if (player.deck.length <= 0) reload(player);

            gameState.phase = "select";
            gameState.queryData = {
                eligible: ".buyable .card",
                message: "Name a card by selecting from the Bank.",
                number: 1,
                unique: true,
                exact: true,
                selected: [],
                callback: function(data) {
                    var revealedCard = player.deck.pop();
                    gameState.revealed.push(revealedCard);
                    console.log(revealedCard);
                    console.log(data);
                    namedCard = cards[data[0].card.id].name;

                    gameState.phase = "choose";
                    gameState.queryData = {
                        number: 1,
                        exact: true,
                        message: cards[revealedCard.id].name + " was revealed.",
                        choices: ["OK"],
                        selected: [],
                        callback: function() {

                            if (cards[revealedCard.id].name === namedCard) {
                                io.sockets.emit("log", " named correctly and drew " + namedCard + ".");
                                player.hand.push(gameState.revealed.pop());
                            }
                            else {
                                player.deck.push(gameState.revealed.pop());
                                io.sockets.emit("log", " you named incorrectly.");
                            }
                            gameState.phase = "action";
                            io.sockets.emit("gameState", gameState);
                        }
                    }
                    io.sockets.emit("gameState", gameState);
                }
            }
        }
    },
     "witch": {
        expansion: "Base",
        description: "+2 Cards, Each other player gains a Curse card.",
        name: "Witch",
        type: "action",
        cost: 5,
        value: 0,
        victory: 0,
        action: function(player) {
            draw(player, 2);
            for (var pid in gameState.players) {
                var aPlayer = gameState.players[pid];
                if (aPlayer.id != player.id) {
                    var acquiredCurse = acquire(aPlayer, "curse");
                    aPlayer.discarded.push(acquiredCurse);
                }
            }
            io.sockets.emit("log", " Each other player gained a Curse!");
            gameState.phase = "action";
            io.sockets.emit("gameState", gameState);
        }
    },  
    "duke": {
        description: "Worth 1 Victory per Duchy you have.",
        name: "Duke",
        type: "victory",
        cost: 5,
        value: 0,
        victory: function(player) {
            var duchyCount = 0;
            for (var i = 0; i < player.deck.length; i++) {
                if (player.deck[1].name === "Duchy") duchyCount++;
            }
            for (var i = 0; i < player.hand.length; i++) {
                if (player.hand[1].name === "Duchy") duchyCount++;
            }
            return duchyCount;
        }
    },
};

exports.cards = cards;