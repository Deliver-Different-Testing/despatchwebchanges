"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bindAllMethods = void 0;
/**
 * Binds all methods of a class instance to the instance itself.
 * This prevents "this" context issues when methods are used as callbacks.
 *
 * @param instance - The class instance to bind methods to
 * @param additionalExcludes - Optional array of additional method names to exclude from binding
 * @returns The instance with bound methods
 */
function bindAllMethods(instance, additionalExcludes = []) {
    // Create the exclusion list including constructor
    const excludeMethods = ['constructor', ...additionalExcludes];
    // Get the prototype of the instance
    const prototype = Object.getPrototypeOf(instance);
    // Get all property names from the prototype
    const propertyNames = Object.getOwnPropertyNames(prototype);
    // Bind each method to the instance
    for (const key of propertyNames) {
        const method = instance[key];
        // Skip excluded methods and non-functions
        if (!excludeMethods.includes(key) &&
            typeof method === 'function') {
            instance[key] = method.bind(instance);
        }
    }
    return instance;
}
exports.bindAllMethods = bindAllMethods;
