
const cirkels = document.querySelectorAll(".cirkel"),
progressieBar = document.querySelector(".indicator"),
buttons = document.querySelectorAll("button")

let huidigeStap = Number(document.body.dataset.stap) || 1
console.log(cirkels, progressieBar, buttons)

const updateStappen = (e) => {
huidigeStap = e.target.id === "volgende" ? ++huidigeStap : --huidigeStap;
console.log(huidigeStap)

cirkels.forEach((cirkel, index) => {
    cirkel.classList[`${index < huidigeStap ? "add" : "remove" }`]("actief")
})}

progressieBar.style.width = `${((huidigeStap - 1) / (cirkels.length - 1)) * 100}%`

buttons.forEach(button => {
    button.addEventListener("click", updateStappen)
})

progressieBar.style.width = `${((huidigeStap - 1) / (cirkels.length - 1)) * 100}%`
