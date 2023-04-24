import express from 'express'
import postgraphile from 'postgraphile'
import cors from 'cors'
import { makeExtendSchemaPlugin, gql } from "graphile-utils"
import { AppDataSource } from './data-source'
import { Product } from './entity/Product'
import { Category } from './entity/Category'
import { Subcategory } from './entity/Subcategory'
import { Supplier } from './entity/Supplier'
import { Uom } from './entity/Uom'
import { Warehouse } from './entity/Warehouse'
import { registerTransaction } from './service/inventory'

/**
 * This is our main entry point of our Express server.
 * All the routes in our API are going to be here.
 **/ 
// const App = () => {
//   const app = express()
//   app.use(express.json())
const pgUser = 'postgres'
const pgPwd = 'root'

/**
* This is our main entry point of our Express server.
* All the routes in our API are going to be here.
**/
const App = () => {
  const app = express()
  app.use(express.json())
  app.use(cors()) // This needs to be added
  app.use(postgraphile(`postgresql://${pgUser}:${pgPwd}@localhost/catalog_db`, 'public', {
    watchPg: true,
    graphiql: true,
    enhanceGraphiql: true,
    appendPlugins: [RegisterTransactionPlugin],
  }))

  app.get('/api/v1/hello', async (req, res, next) => {
    res.send('success')
  })  

  app.post('/api/v1/test/data', async (req, res, next) => {
    // UOM
    const each = new Uom()
    each.name = 'Each'
    each.abbrev = 'EA'
    await AppDataSource.manager.save(each)

    // Category 
    const clothing = new Category()
    clothing.description = 'Clothing'
    await AppDataSource.manager.save(clothing)

    // Subcategories
    const tShirts = new Subcategory()
    tShirts.category = clothing
    tShirts.description = 'T-Shirts'

    const coat = new Subcategory()
    coat.category = clothing
    coat.description = 'Coat'
    await AppDataSource.manager.save([tShirts, coat])

    // Supplier
    const damageInc = new Supplier()
    damageInc.name = 'Damage Inc.'
    damageInc.address = '221B Baker St'
    await AppDataSource.manager.save(damageInc)

    // Warehouse
    const dc = new Warehouse()
    dc.name = 'DC'
    await AppDataSource.manager.save(dc)

    // Product
    const p1 = new Product()
    p1.category = clothing
    p1.description = 'Daily Black T-Shirt'
    p1.sku = 'ABC123'
    p1.subcategory = tShirts
    p1.uom = each

    const p2 = new Product()
    p2.category = clothing
    p2.description = 'Beautiful Coat'
    p2.sku = 'ZYX987'
    p2.subcategory = coat
    p2.uom = each
    
    // Note: this product intentionally does not have a subcategory
    // (it's configured to be nullable: true).
    const p3 = new Product()
    p3.category = clothing
    p3.description = 'White Glove'
    p3.sku = 'WG1234'
    p3.uom = each
    await AppDataSource.manager.save([p1, p2, p3])

    res.send('data seeding completed!')
  })  
  
  return app
}

const RegisterTransactionPlugin = makeExtendSchemaPlugin(_build => {
 return {
   typeDefs: gql`
      input RegisterTransactionInput {
        type: InventoryTransactionTypeEnum!
        productId: Int!
        warehouseId: Int!
        quantity: Int!
      }

      type RegisterTransactionPayload {
        transactionId: Int,
        productId: Int,
        warehouseId: Int,
        updatedQuantity: Int,
      }

      extend type Mutation {
        registerTransaction(input: RegisterTransactionInput!): RegisterTransactionPayload
      }     
    `,
    resolvers: {
      Mutation: {
        registerTransaction: async (_query, args, _context, _resolveInfo) => {
          try {
            const { type, productId, warehouseId, quantity } = args.input
            const inventoryTransaction = await registerTransaction(type, productId, warehouseId, quantity)
            return { ...inventoryTransaction }
          } catch (e) {
            console.error('Error registering transaction', e)
            throw e
          }
        }
      }
    },
 };
});

export default App