import { Schema } from "mongoose";
import { IModel, IDocumentModel } from "../data/base";
import { RepositoryBase, Repository } from "../db/base";

export interface IServiceBase {

}

export abstract class ServiceBase<T extends IModel, TModel extends IDocumentModel<IModel> & IModel & T> implements IServiceBase {
    protected repo: RepositoryBase<T, TModel>;

    constructor(schema: Schema, name: string) {
        this.repo = new Repository<T, TModel>(schema, name, true); // Set useSecondary to true
    }

    async create(item: T): Promise<T> {
        // let tm: TModel = this.repo.;
        return await this.repo.create(item);
    }

    async updateOne(_id: string, item: T): Promise<T> {
        return await this.repo.updateOne(_id, item);
    }

    async updatePart(query: any, item: any): Promise<T> {
        return await this.repo.updatePart(query, item);
    }

    async updatePartWithOptions(query: any, item: any, options: any): Promise<T> {
        return await this.repo.updatePartWithOptions(query, item, options);
    }

    async updateMany(query: any, item: any): Promise<T> {
        return await this.repo.updateMany(query, item);
    }

    async findOneUpdate(query: any, item: any): Promise<T> {
        return await this.repo.findOneUpdate(query, item);
    }

    async delete(_id: string): Promise<any> {
        return await this.repo.delete(_id);
    }

    async deleteOne(cond: any): Promise<any> {
        return await this.repo.delete(cond);
    }

    async findById(_id: string): Promise<T> {
        return await this.repo.findById(_id);
    }

    async findByIdSelect(_id: string, selectQuery: any): Promise<T> {
        return await this.repo.findByIdSelect(_id, selectQuery);
    }

    async findOne(cond: any): Promise<T> {
        return await this.repo.findOne(cond);
    }

    async findOneSelect(cond: any, selectQuery: any): Promise<T> {
        return await this.repo.findOneSelect(cond, selectQuery);
    }

    async find(cond: any): Promise<T[]> {
        return await this.repo.find(cond);
    }

    async findLatest(cond: any): Promise<T> {
        return await this.repo.findLatest(cond);
    }

    async findSelect(cond: any, selectQuery: any): Promise<T[]> {
        return await this.repo.findSelect(cond, selectQuery);
    }

    async findPaginated(limit: number, sort: any, cond: any, selectQuery: any): Promise<T[]> {
        return await this.repo.findPaginated(limit, sort, cond, selectQuery);
    }

    async findPaginatedSkip(limit: number, skip: number, sort: any, cond: any, selectQuery: any): Promise<T[]> {
        return await this.repo.findPaginatedSkip(limit, skip, sort, cond, selectQuery);
    }

    async findCount(cond: any): Promise<number> {
        return await this.repo.findCount(cond);
    }

    async findAggregate<TResult = T>(projections: any): Promise<TResult[]> {
        return await this.repo.findAggregate<TResult>(projections);
    }
}
