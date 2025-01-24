import {Request, Response} from "express";

export const demoRouteHandler = async (req: Request<unknown, unknown, unknown, {
    environment: string;
}>, res: Response) => {
    res.json({message: "hello from demo lambda"});
};
