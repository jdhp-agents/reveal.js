// Ce code sera exécuté lorsque la page aura fini de charger
window.onload = function() {
    var currentLanguage = "en"; // Mettez la valeur de la langue actuelle ici

    var frNotes = document.querySelectorAll('.fr-notes');
    var enNotes = document.querySelectorAll('.en-notes');

    // With pre-wrap, the newline after the opening tag and the indentation before the
    // closing tag would show up as two blank lines in the speaker view: trim them
    function showNotes(notes) {
        notes.style.whiteSpace = 'pre-wrap';
        notes.innerHTML = notes.innerHTML.replace(/^[ \t]*\n/, '').replace(/\s+$/, '');
    }

    if (currentLanguage === "fr") {
        for(var i = 0; i < frNotes.length; i++) {
            showNotes(frNotes[i]);
        }

        // Hide English speaker notes
        for(var i = 0; i < enNotes.length; i++) {
            enNotes[i].style.display = 'none';
        }
    } else if (currentLanguage === "en") {
        for(var i = 0; i < enNotes.length; i++) {
            showNotes(enNotes[i]);
        }

        // Hide French speaker notes
        for(var i = 0; i < frNotes.length; i++) {
            frNotes[i].style.display = 'none';
        }
    }
}