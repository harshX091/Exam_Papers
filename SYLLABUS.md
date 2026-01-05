Syllabus data format
--------------------

Place syllabus files in the `data/` folder named `syllabus_sem_1.json` .. `syllabus_sem_6.json`.

File structure:

[
  {
    "subject": "Physics",
    "units": [
      {
        "unit": 1,
        "title": "Mechanics",
        "materials": [
          {"title":"Lecture Notes","file":"pdfs/...","description":"optional"}
        ]
      }
    ]
  }
]

Notes:
- `file` can point to any URL or a path under the `pdfs/` folder.
- The site currently shows a 'Syllabus' view when you open `pdfs.html?sem=Sem_4&subject=Physics&view=syllabus`.

Folder conventions and automation
- Arrange your PDFs under `pdfs/` like `pdfs/Sem4/Physics/Unit_1/Mechanics_Notes.pdf`.
- Unit folder names can be `Unit1`, `Unit_1`, `U1`, `Unit-1` — the import script detects them.
- The site now shows unit filter controls in the Syllabus view to quickly show a specific unit's materials.
- You can run the scanner to populate `data/sem_4.json` and `data/syllabus_sem_4.json`:

  ```bash
  node scripts/generateData.js
  ```

Sidecar metadata
- To customize titles, descriptions, year or subject for a PDF, add a sidecar JSON with the same name and `.json` suffix next to the PDF file. Example `Mechanics_Notes.pdf.json`:

  ```json
  {
    "title": "Mechanics — Lecture Notes",
    "description": "Short notes covering laws of motion",
    "year": 2024,
    "subject": "Physics"
  }
  ```
