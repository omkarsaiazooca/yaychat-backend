import { Model, Schema, Types } from 'mongoose';
import { IDocumentModel, IModel } from '../data/base';
import * as mongo from './connection';

export interface IReadBase<T extends IModel> {
    findById(_id: string): Promise<T>;
    findByIdSelect(_id: string, selectQuery: any): Promise<T>;
    findOne(cond: any): Promise<T>;
    findOneSelect(cond: any, selectQuery: any): Promise<T>;
    find(cond: any): Promise<T[]>;
    findLatest(cond: any): Promise<T>;
    findSelect(cond: any, selectQuery: any): Promise<T[]>;
    findPaginated(limit: number, sort: any, cond: any, selectQuery: any): Promise<T[]>;
    findPaginatedSkip(limit: any, skip: any, sort: any, cond: any, selectQuery: any): Promise<T[]>;
    findCount(cond: any): Promise<number>;
    findAggregate<TResult = T>(projections: any): Promise<TResult[]>;
}

export interface IWriteBase<T extends IModel> {
    create(item: T): Promise<T>;
    createMany(items: T[]): Promise<T[]>;
    updateOne(_id: string, item: T): Promise<T>;
    updatePart(query: any, item: any): Promise<T>;
    updatePartWithOptions(query: any, item: any, options: any): Promise<T>;
    updateMany(query: any, item: any): Promise<T>;
    findOneUpdate(query: any, item: any): Promise<T>;
    delete(_id: string): Promise<any>;
}

export interface IRepositoryBase<T extends IModel> extends IReadBase<T>, IWriteBase<T> { }

export abstract class RepositoryBase<T extends IModel, TModel extends IDocumentModel<IModel> & IModel & T> implements IRepositoryBase<IModel> {

    protected _model: Model<TModel>;

    constructor(schema: Schema, name: string, useSecondary = false) {
        const connection = useSecondary ? mongo.default.secondary : mongo.default.primary;
        this._model = connection.model<TModel>(name, schema, name);
    }

    async create(item: T): Promise<T> {
        let tmodel = new this._model(item);
        return await tmodel.save();
    }

    async createMany(items: T[]): Promise<T[]> {
        return await this._model.insertMany(items as any) as any;
    }

    async updateOne(_id: string, item: T): Promise<any> {
        return await this._model.updateOne({ _id: this.toObjectId(_id) } as any, item).exec();
    }

    async updatePart(query: any, item: any): Promise<any> {
        return await this._model.updateOne(query, item).exec();
    }

    async updateOneWithOptions(query: any, item: any, options: any = {}): Promise<any> {
        return this._model.updateOne(query, item, options).exec();
    }

    async updatePartWithOptions(query: any, item: any, options: { arrayFilters?: any[], multi?: boolean } = {}): Promise<any> {
        const updateOptions = {
            new: true,
            arrayFilters: options.arrayFilters || [],
            multi: options.multi || false
        };
        return await this._model.updateOne(query, item, updateOptions).exec();
    }

    async upsertOne(filter: any, update: any): Promise<any> {
        return this._model.updateOne(filter, update, { upsert: true }).exec();
    }

    async upsertOneAndGet(filter: any, update: any, options: any = {}): Promise<T> {
        return this._model.findOneAndUpdate(
            filter,
            update,
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                ...options,
            }
        ).exec() as any;
    }

    async updateMany(query: any, item: any): Promise<any> {
        return await this._model.updateMany(query, item).exec();
    }

    async findOneUpdate(query: any, item: any, options?: any): Promise<any> {
        return await this._model.findOneAndUpdate(query, item, options).exec();
    }

    async delete(_id: string): Promise<any> {
        return await this._model.deleteOne({ _id: this.toObjectId(_id) } as any).exec();
    }

    async deleteMany(cond: any): Promise<any> {
        return await this._model.deleteMany(cond).exec();
    }

    async deleteOne(cond: any): Promise<any> {
        return await this._model.deleteOne(cond).exec();
    }

    async findById(_id: string): Promise<any> {
        return await this._model.findById(_id).exec();
    }

    async findByIdSelect(_id: string, selectQuery: any): Promise<any> {
        return await this._model.findById(_id).select(selectQuery).exec();
    }

    async findOne(cond: any): Promise<any> {
        return await this._model.findOne(cond).exec();
    }

    async findOneSelect(cond: any, selectQuery: any): Promise<any> {
        return await this._model.findOne(cond).select(selectQuery).exec();
    }

    async find(cond: any): Promise<T[]> {
        return await this._model.find(cond).exec();
    }

    async findLatest(cond: any): Promise<any> {
        return await this._model.findOne(cond).sort({ _id: -1 }).limit(1).exec();
    }

    async findSelect(cond: any, selectQuery: any): Promise<T[]> {
        return await this._model.find(cond).select(selectQuery).exec();
    }

    async findPaginated(limit: number, sort: any, cond: any, selectQuery: any): Promise<T[]> {
        return await this._model.find(cond).sort(sort).limit(limit).select(selectQuery).exec();
    }

    async findPaginatedSkip(limit: number, skip: number, sort: any, cond: any, selectQuery: any): Promise<T[]> {
        return await this._model.find(cond).sort(sort).limit(limit).skip(skip).select(selectQuery).exec();
    }

    async findCount(cond: any): Promise<number> {
        return await this._model.countDocuments(cond).exec();
    }

    async findAggregate<TResult = T>(projections: any): Promise<TResult[]> {
        return await this._model.aggregate<TResult>(projections).exec();
    }

    private toObjectId(_id: string): any {
        return Types.ObjectId.createFromHexString(_id);
    }
}

export class Repository<T extends IModel, TModel extends IDocumentModel<IModel> & IModel & T> extends RepositoryBase<T, TModel> {
    constructor(schema: Schema, name: string, useSecondary = false) {
        super(schema, name, useSecondary);
    }
}
