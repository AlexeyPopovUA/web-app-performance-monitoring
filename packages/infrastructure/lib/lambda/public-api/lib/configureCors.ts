import {CorsOptions} from "cors";

/**
 * Shared CORS configuration for all routes
 */
export const getCorsCfg = (): CorsOptions => ({
    /**
     * If origin header is not "allowed", it will be replaced by the fallback origin in the OPTIONS response.
     * So request fails with CORS error in a browser
     */
    origin: (origin, callback) => {
        callback(null, origin);
    },
    // allowed methods
    methods: ["OPTIONS", "GET", "POST"]
});
