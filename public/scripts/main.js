
const cirkels = document.querySelectorAll(".cirkel"),
progressieBar = document.querySelector(".indicator")

let huidigeStap = Number(document.body.dataset.stap) || 1

progressieBar.style.width = `${((huidigeStap - 1) / (cirkels.length - 1)) * 100}%`

function slaAntwoordOp(vraag, waarde) {
    const antwoorden = JSON.parse(localStorage.getItem("vragenlijst")) || {};
    antwoorden[vraag] = waarde;
    localStorage.setItem("vragenlijst", JSON.stringify(antwoorden));
}

function kiesGenre(genre) {
    slaAntwoordOp("genre", genre);
}   

function kiesSfeer(sfeer) {
    slaAntwoordOp("sfeer", sfeer);
}

function kiesBelangrijk(belangrijk) {
    slaAntwoordOp("belangrijk", belangrijk);
}

function kiesPeriode(periode) {
    slaAntwoordOp("periode", periode);
}

function kiesDoelgroep(doelgroep) {
    slaAntwoordOp("doelgroep", doelgroep);
}

function kiesTaal(taal) {
    slaAntwoordOp("taal", taal);
}

const vragenForm = document.querySelector("#vragenForm");
const antwoordenInput = document.querySelector("#antwoordenInput");

if (vragenForm && antwoordenInput) {
    vragenForm.addEventListener("submit", () => {
        antwoordenInput.value = localStorage.getItem("vragenlijst") || "{}";
    });
}
