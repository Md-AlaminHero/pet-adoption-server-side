const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require("jsonwebtoken")
require('dotenv').config();
const port = process.env.PORT || 3000;
// const admin = require("firebase-admin");


app.use(cors());
app.use(express.json());






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nrp7gyz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = "mongodb+srv://<db_username>:<db_password>@cluster0.nrp7gyz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        // Get the database and collection
        const db = client.db('petAdoption')
        const usersCollection = client.db("petAdoption").collection("users");
        const petsCollection = client.db("petAdoption").collection("pets");

        const verifyJWT = (req, res, next) => {
            const authHeader = req?.headers?.authorization;
            if (!authHeader) return res.status(401).send({ message: 'Unauthorized' });

            const token = authHeader.split(' ')[1];
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                console.log(err);
                if (err) return res.status(403).send({ message: 'Forbidden' });
                req.decoded = decoded;
                next();
            });
        };

        // Middleware: check admin role
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email });

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Access Denied: Admin Only' });
            }

            next();
        };


        // POST /users - Save user with default role
        app.post("/users", async (req, res) => {
            const user = req.body;
            if (!user || !user.email) {
                return res.status(400).send({ error: "Invalid user data" });
            }

            // Optional: Check if user already exists
            const existing = await usersCollection.findOne({ email: user.email });
            if (existing) {
                return res.status(200).send({ message: "User already exists" });
            }

            // Insert user with default role
            const newUser = {
                name: user.name,
                email: user.email,
                photoURL: user.photoURL,
                role: user.role || "user",
                createdAt: new Date(),
            };

            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        });

        app.post('/jwt', (req, res) => {
            const { email } = req.body;

            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d'
            });

            res.send({ token });
        });


        // post method by user add pet

        app.post('/pets', async (req, res) => {
            const pet = req.body;
            const result = await petsCollection.insertOne(pet);
            res.send(result);
        });


        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.send(user);
        });

        app.get('/users/role/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email });
            res.send({ role: user?.role || 'user' });
        });



        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('pet adoption server is ready')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})


