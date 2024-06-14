import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "books",
  password: "Monkey",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");

app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books");
    const books = result.rows;
    res.render("index", { books });
  } catch (error) {
    console.error("Error fetching books:", error.message);
    res.render("error", { message: "Error fetching books" });
  }
});

app.post("/add-book", async (req, res) => {
  const { isbn, description } = req.body;
  try {
    const response = await axios.get(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const bookData = response.data[`ISBN:${isbn}`];

    if (bookData) {
      const title = bookData.title;
      const author = bookData.authors.map((author) => author.name).join(", ");
      const coverUrl = bookData.cover ? bookData.cover.large : null;

      await db.query(
        "INSERT INTO books (isbn, title, author, cover_url, description) VALUES ($1, $2, $3, $4, $5)",
        [isbn, title, author, coverUrl, description]
      );
      res.redirect("/");
    } else {
      res.render("error", { message: "No book found with this ISBN" });
    }
  } catch (error) {
    console.error("Error adding book:", error.message);
    res.render("error", { message: "Error adding book" });
  }
});

app.get("/edit/:id", async (req, res) => {
  const bookId = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [
      bookId,
    ]);
    const book = result.rows[0];
    res.render("edit", { book });
  } catch (error) {
    console.error("Error fetching book details:", error.message);
    res.render("error", { message: "Error fetching book details" });
  }
});

app.post("/edit/:id", async (req, res) => {
  const bookId = req.params.id;
  const { isbn, description } = req.body;
  try {
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
    const bookDataResponse = await axios.get(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const bookData = bookDataResponse.data[`ISBN:${isbn}`];

    if (bookData) {
      const title = bookData.title || "Unknown Title";
      await db.query(
        "UPDATE books SET isbn = $1, description = $2, cover_url = $3, title = $4 WHERE id = $5",
        [isbn, description, coverUrl, title, bookId]
      );
    } else {
      throw new Error("Book data not found");
    }

    res.redirect("/");
  } catch (error) {
    console.error("Error updating book:", error.message);
    res.render("error", { message: "Error updating book" });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", { message: "Something went wrong!" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
