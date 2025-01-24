import express from "express";
import cors from "cors";

import {getCorsCfg} from "./lib/configureCors";
import {demoRouteHandler} from "./routes/demo";
import {browseResourcesRouteHandler} from "./routes/browse-resources";

const app = express();

// shared CORS configuration for all routes
app.use(cors(getCorsCfg()));

const router = express.Router();
router.use(express.json());
router.use(express.urlencoded({extended: true}));

/**
 * This route is for Node.js or mobile applications where environment name is sent via "environment" query parameter
 */
router.get("/demo", demoRouteHandler);
router.get("/browse-resources", browseResourcesRouteHandler);

app.use("/", router);

export {app};
