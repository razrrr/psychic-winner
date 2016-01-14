"use strict";
var app = angular.module("Dominion", ["ngAnimate"]);
var cards;
app.run(function($rootScope) {
    var socket = io.connect();
    var playerID;
    $rootScope.gameState = {};
    $rootScope.cards = cards;
    $rootScope.physicalCards = [];
    socket.on("log", function(msg) {
        $("#output").append("<br/>" + msg);
        $("#output")[0].scrollTop = $("#output")[0].scrollHeight;
    });
    socket.on("gameState", function(update) {
        $(".start.button").hide();
        $rootScope.you = {
            id: "/#" + socket.id
        };
        playerID = "/#" + socket.id;
        $rootScope.gameState = update;
        $rootScope.clientPlayer = $rootScope.gameState.players[playerID];
        // UI stuff
        /*$rootScope.physicalCards = [];
        for (var playerID in $rootScope.gameState.players) {
            var player = $rootScope.gameState.players[playerID];
            $rootScope.physicalCards = $rootScope.physicalCards.concat(player.hand);
            $rootScope.physicalCards = $rootScope.physicalCards.concat(player.deck);
            $rootScope.physicalCards = $rootScope.physicalCards.concat(player.discard);
        }*/
        // end UI stuff

        // apply gameState changes to UI
        $rootScope.$apply();

        // Prompt Current Player for a Selection
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        if ($rootScope.gameState.phase === "select") {
            $(".card").removeClass("selectable");
            $(".select.button").hide();
            setTimeout(function() {
                $($rootScope.gameState.queryData.eligible).addClass("selectable");
            }, 100);
            if (!$rootScope.gameState.queryData.exact) $(".select.button").show();
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                $(".selectable").removeClass("selectable");
                socket.emit("select", $rootScope.gameState.queryData.selected);
            }
        }
        if ($rootScope.gameState.phase === "choose") {

        }

    });
    $rootScope.endTurn = function() {
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
        if ($rootScope.gameState.phase == "select" || $rootScope.gameState.phase == "choose") return;
        socket.emit("endTurn", {});
    };
    $rootScope.choose = function(index, event) {
        if ($(event.target).hasClass("choosable")) {
            $rootScope.gameState.queryData.selected.push(index);
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                socket.emit("callback", $rootScope.gameState.queryData.selected);
            }
        }
    }
    $rootScope.select = function(card, index, zone, event) { // user clicked on a card
        console.log(event);
        if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;

        if ($rootScope.gameState.phase === "action" && zone == "hand") {
            socket.emit("play", {
                cardID: card.id,
                cardIndex: index,
                playerID: playerID
            });
        }
        if ($rootScope.gameState.phase === "buy" && zone == "hand" && cards[card.id].type.indexOf("treasure") >= 0) {
            socket.emit("play", {
                cardID: card.id,
                cardIndex: index,
                playerID: playerID
            });
        }
        if (($rootScope.gameState.phase === "action" || $rootScope.gameState.phase === "buy") && zone == "buy") {
            socket.emit("buy", {
                cardID: card.id,
                playerID: playerID
            });
        }

        // event.target will get caught by foreground images thus blocking the correct click event
        if ($rootScope.gameState.phase === "select" && $(event.currentTarget).hasClass("selectable")) {
            if ($rootScope.gameState.queryData.unique === true) {
                $(event.currentTarget).removeClass("selectable");
            }
            var data = {
                card: card,
                index: index,
                zone: zone,
            };
            console.log(data)
            $rootScope.gameState.queryData.selected.push(data);
            if ($rootScope.gameState.queryData.number === $rootScope.gameState.queryData.selected.length) {
                $(".selectable").removeClass("selectable");
                socket.emit("select", $rootScope.gameState.queryData.selected);
            }
        }
    };
    $rootScope.startGame = function() {
        for (var id in cards) {
            cards[id].id = id;
        }
        $(".start.button").hide();
        $rootScope.$watch("clientPlayer.coins", function() {
            $(".buyable .card").addClass("disabled");
            if ($rootScope.clientPlayer.buys === 0) return;
            if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
            for (var i = 0; i <= $rootScope.clientPlayer.coins; i++) {
                $(".buyable .card.COST" + i).removeClass("disabled");
            }
        });
        $rootScope.$watch("gameState.phase", function() {
            if ($rootScope.gameState.playerOrder[$rootScope.gameState.activePlayer] != playerID) return;
            $(".your.player .hand .action").addClass("disabled");
            if ($rootScope.gameState.phase == "action" && $rootScope.clientPlayer.actions > 0) $(".your.player .hand .action").removeClass("disabled");
        });
        socket.emit("startGame");
    };
    $rootScope.submit = function() {
        $(".selectable").removeClass("selectable");
        socket.emit("select", $rootScope.gameState.queryData.selected);
    };
});
