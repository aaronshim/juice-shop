/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Request, Response, NextFunction } from 'express'
import { ProductModel } from '../models/product'

export function updateProduct () {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id
    ProductModel.findByPk(id).then(product => {
      if (product) {
        // VULNERABILITY: No input validation or sanitization
        product.update({ name: req.body.name }).then(updatedProduct => {
          res.json({ data: updatedProduct })
        }).catch(error => {
          next(error)
        })
      } else {
        res.status(404).send('Not found')
      }
    }).catch(error => {
      next(error)
    })
  }
}
