const express = require('express');
const cors = require('cors');
// const Stripe = require('stripe');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require("jsonwebtoken")
require('dotenv').config();
const port = process.env.PORT || 3000;
// const admin = require("firebase-admin");


app.use(cors());
app.use(express.json());





// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
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
        const donationCollection = client.db("petAdoption").collection("donation");
        const adoptionCollection = client.db("petAdoption").collection("adoption-Request");

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


        // get method for get all pets
        app.get("/all-pets", async (req, res) => {
            const { search = "", category = "", page = 1 } = req.query;
            const limit = 10;
            const skip = (parseInt(page) - 1) * limit;

            const query = {
                adopted: false,
                name: { $regex: search, $options: "i" },
            };
            if (category) {
                query.category = category;
            }

            const pets = await petsCollection
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();

            res.send(pets);
        });

        // GET: Get pet by ID
        app.get("/pet/:id", async (req, res) => {
            const id = req.params.id;
            const pet = await db.collection("pets").findOne({ _id: new ObjectId(id) });
            res.send(pet);
        });


        // POST: Save adoption request
        app.post("/adoption-request", async (req, res) => {
            const adoption = req.body;
            adoption.createdAt = new Date();

            const result = await adoptionCollection.insertOne(adoption);
            res.send(result);
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


        // get method by user
        // Example: GET /pets?email=user@example.com
        app.get('/pets', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.status(400).send({ message: 'Email is required' });
            }

            try {
                const pets = await petsCollection.find({ ownerEmail: email }).toArray();
                res.send(pets);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch pets' });
            }
        });


        // patch method by user
        app.patch('/pets/adopt/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    adopted: true
                }
            };
            const result = await petsCollection.updateOne(filter, updateDoc);
            res.send(result);
        });


        // delete method by user


        app.delete('/pets/:id', async (req, res) => {
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid ID' });
            }

            const query = { _id: new ObjectId(id) };
            const result = await petsCollection.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).send({ message: 'Pet not found' });
            }

            res.send({ deletedCount: result.deletedCount });
        });

        // Update method by user
        app.get('/pets/:id', async (req, res) => {
            const id = req.params.id;
            const pet = await petsCollection.findOne({ _id: new ObjectId(id) });
            res.send(pet);
        });


        app.put('/pets/:id', async (req, res) => {
            const id = req.params.id;
            const updatedPet = req.body;

            const result = await petsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedPet }
            );
            res.send(result);
        });


        // server.js or routes file
        app.get("/donation-campaigns", async (req, res) => {
            try {
                const { page = 1 } = req.query;
                const limit = 9;
                const skip = (parseInt(page) - 1) * limit;

                const campaigns = await donationCollection
                    .find({})
                    .sort({ createdAt: -1 }) // Sort by date descending
                    .sort({ lastDate: -1 }) // Sort by date descending
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.send(campaigns);
            } catch (err) {
                console.error("Error fetching campaigns", err);
                res.status(500).send({ message: "Internal server error" });
            }
        });

        // get donation-campaigns details
        app.get('/donation-campaigns/:id', async (req, res) => {
            const camp = await donationCollection.findOne({ _id: new ObjectId(req.params.id) });
            res.send(camp);
        });

        // Get recommended campaigns (3 active, excluding current)
        app.get("/donation-campaigns/recommended/:excludeId", async (req, res) => {
            try {
                const excludeId = req.params.excludeId;
                const campaigns = await donationCollection
                    .find({ _id: { $ne: new ObjectId(excludeId) }, paused: { $ne: true } })
                    .sort({ createdAt: -1 })
                    .limit(3)
                    .toArray();
                res.send(campaigns);
            } catch (error) {
                res.status(500).send({ message: "Server error" });
            }
        });

        // create payment intent
        // app.post('/create-payment-intent', async (req, res) => {
        //     const { amount } = req.body;
        //     const paymentIntent = await stripe.paymentIntents.create({
        //         amount: Math.round(amount * 100), // in cents
        //         currency: 'usd',
        //         automatic_payment_methods: { enabled: true },
        //     });
        //     res.json({ clientSecret: paymentIntent.client_secret });
        // });



        // post by user
        // POST /donation-campaigns
        app.post("/donation-campaigns", async (req, res) => {
            try {
                const newCampaign = req.body;
                newCampaign.createdAt = new Date();
                const result = await donationCollection.insertOne(newCampaign);
                res.send(result);
            } catch (err) {
                res.status(500).send({ message: "Failed to create campaign" });
            }
        });

        // Get all donations by a user
        // app.get("/donation-campaigns/user/:email", async (req, res) => {
        //     const email = req.params.email;

        //     const campaigns = await donationCollection.find({ requesterEmail: email }).toArray();

        //     res.send(campaigns);
        // });

        // // Pause/Unpause donation
        // app.patch('/donations/pause/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const { paused } = req.body;
        //     const result = await donationCollection.updateOne(
        //         { _id: new ObjectId(id) },
        //         { $set: { paused } }
        //     );
        //     res.send(result);
        // });

        // // Get donators of a donation
        // app.get('/donations/donators/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const donation = await donationCollection.findOne({ _id: new ObjectId(id) });
        //     res.send(donation?.donations || []);
        // });

        app.get("/donation-campaigns/user/:email", async (req, res) => {
            try {
                const email = decodeURIComponent(req.params.email);
                console.log("Fetching campaigns for email:", email);

                const campaigns = await donationCollection.find({
                    "creator.email": { $regex: `^${email}$`, $options: "i" } // case-insensitive exact match on nested field
                }).toArray();

                console.log("Found campaigns count:", campaigns.length);
                res.send(campaigns);
            } catch (error) {
                console.error("Error fetching campaigns:", error);
                res.status(500).send({ message: "Server Error" });
            }
        });

        // GET single campaign
        app.get("/donation-campaigns/:id", async (req, res) => {
            const { id } = req.params;
            const campaign = await donationCollection.findOne({ _id: new ObjectId(id) });
            res.send(campaign);
        });

        // PATCH update campaign
        app.patch("/donation-campaigns/:id", async (req, res) => {
            const { id } = req.params;
            const updateData = req.body;

            const result = await donationCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updateData }
            );
            res.send(result);
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


